import type { BrainstormTurn, InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import type { ProjectConnectorState } from "@/lib/connectors/registry";
import {
  buildExpandedRetrievalQuery,
  detectRetrievalTopic,
  mergeRetrievedChunks,
  pinnedChunkIds,
  topicScoreAdjust,
} from "./buildRetrieve";
import { summarizeBuiltState } from "./builtState";
import { listEditableCopyFields } from "./previewCopyFields";
import type { ReadinessItem } from "./readinessAudit";
import type { ExpoAppModel, ExpoListItem } from "./types";
import { getStringAtPath } from "./tweakPaths";

/** One searchable unit — like a Cursor codebase chunk. */
export interface BuildContextChunk {
  id: string;
  kind: "copy" | "screen" | "item" | "memory" | "connector" | "checklist" | "flow";
  screen: string;
  label: string;
  path?: string;
  value?: string;
  /** Text used for retrieval scoring. */
  text: string;
}

const SCREEN_HINTS: { re: RegExp; screens: string[] }[] = [
  { re: /\b(first|1st|opening|launch|start)\s+screen\b|\bfirst screen\b/i, screens: ["welcome", "onboarding-0"] },
  { re: /\bwelcome\b/i, screens: ["welcome"] },
  { re: /\bonboarding\b/i, screens: ["onboarding", "onboarding-0"] },
  { re: /\brole\s*picker|choose\s+(your\s+)?role|pick\s+(your\s+)?role\b/i, screens: ["role"] },
  { re: /\b(sign[\s-]?in|log[\s-]?in)\b/i, screens: ["sign-in"] },
  { re: /\b(sign[\s-]?up|register|create\s+account)\b/i, screens: ["sign-up"] },
  { re: /\bsetup|profile\s+setup|wizard|tell us about you|get started\b/i, screens: ["setup"] },
  { re: /\bhome\b/i, screens: ["home"] },
  { re: /\blisting(s)?|walk card(s)?|feed card(s)?\b/i, screens: ["home"] },
  { re: /\bstatus chip(s)?|open|matched|done\b/i, screens: ["home"] },
  { re: /\bnear you|neighborhood|distance|area label\b/i, screens: ["home"] },
  { re: /\bprofile\b/i, screens: ["profile"] },
  { re: /\bmessages?|chat|inbox\b/i, screens: ["messages"] },
];

const LISTING_ITEM_FIELDS: {
  key: keyof Pick<
    ExpoListItem,
    "title" | "subtitle" | "meta" | "badge" | "primaryAction" | "quote"
  >;
  emptyHint?: string;
  alwaysIndex?: boolean;
}[] = [
  { key: "title" },
  { key: "subtitle" },
  { key: "badge", emptyHint: "(empty — set status chip e.g. Open, Matched, Done)", alwaysIndex: true },
  { key: "meta", emptyHint: "(empty — neighborhood / distance label)", alwaysIndex: true },
  { key: "primaryAction" },
  { key: "quote" },
];

function indexListItemFields(input: {
  push: (chunk: BuildContextChunk) => void;
  screen: string;
  screenLabel: string;
  basePath: string;
  item: ExpoListItem;
  cardIndex: number;
}): void {
  const { push, screen, screenLabel, basePath, item, cardIndex } = input;

  for (const field of LISTING_ITEM_FIELDS) {
    const val = item[field.key];
    const str = typeof val === "string" ? val.trim() : "";
    if (!str && !field.alwaysIndex) continue;

    const path = `${basePath}.${field.key}`;
    const display = str || field.emptyHint || "(empty)";
    const chipNote =
      field.key === "badge" ? " · status chip on card" : field.key === "meta" ? " · area/distance" : "";

    push({
      id: `item:${path}`,
      kind: "item",
      screen,
      label: `${screenLabel} card ${cardIndex + 1} ${field.key}`,
      path,
      value: str || undefined,
      text:
        `${screenLabel} · walk listing card ${cardIndex + 1} · ${field.key}${chipNote}: ` +
        `"${display}" [path: ${path}] title="${item.title}"`,
    });
  }
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function words(s: string): string[] {
  return norm(s).split(" ").filter((w) => w.length > 2);
}

function overlapScore(a: string, b: string): number {
  const aw = new Set(words(a));
  const bw = words(b);
  if (!aw.size || !bw.length) return 0;
  let hit = 0;
  for (const w of bw) {
    if (aw.has(w)) hit++;
  }
  return hit / Math.max(aw.size, bw.length);
}

function quotedPhrases(msg: string): string[] {
  const out: string[] = [];
  const re = /"([^"]{4,})"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(msg))) out.push(m[1]!.trim());
  return out;
}

function screenBoost(msg: string, screen: string, label: string): number {
  let boost = 0;
  for (const hint of SCREEN_HINTS) {
    if (!hint.re.test(msg)) continue;
    if (hint.screens.some((s) => screen === s || screen.startsWith(s))) {
      boost += 0.4;
    }
  }
  if (/\btitle\b/i.test(msg) && /title|headline|label/.test(label)) boost += 0.15;
  if (/\bsubtitle|subtext|description\b/i.test(msg) && /subtitle|description|subheadline/.test(label)) {
    boost += 0.15;
  }
  return boost;
}

/** Index everything Build can see — copy lines, screens, cards, memory. */
export function indexBuildContext(input: {
  model: ExpoAppModel;
  mp: MasterBuildPrompt;
  interview?: InterviewTurn[];
  brainstormHistory?: BrainstormTurn[];
  buildHistory?: BrainstormTurn[];
  brainstormSummary?: string;
  connectorNote?: string;
  connectorState?: ProjectConnectorState;
  readinessItems?: ReadinessItem[];
}): BuildContextChunk[] {
  const chunks: BuildContextChunk[] = [];
  const { model, mp } = input;

  const push = (chunk: BuildContextChunk) => chunks.push(chunk);

  push({
    id: "flow-order",
    kind: "flow",
    screen: "flow",
    label: "Launch flow order",
    text:
      `Launch flow: welcome screen → role picker → profile setup → sign-in → ` +
      `${model.onboarding.length ? `${model.onboarding.length} onboarding slide(s) → ` : ""}` +
      `main tabs (${model.tabs.map((t) => t.label).join(", ")}).`,
  });

  for (const field of listEditableCopyFields(model, mp.appName)) {
    push({
      id: `copy:${field.path}`,
      kind: "copy",
      screen: field.screen,
      label: field.label,
      path: field.path,
      value: field.value,
      text: `${field.screen} screen · ${field.label}: "${field.value}" [path: ${field.path}]`,
    });
  }

  push({
    id: "screen:home",
    kind: "screen",
    screen: "home",
    label: "Home tab",
    text:
      `Home tab — hero "${model.home.headline}" · ` +
      `${model.home.sections.reduce((n, s) => n + s.items.length, 0)} walk listing card(s) in sections.`,
  });

  const listingLines: string[] = [];
  for (let si = 0; si < model.home.sections.length; si++) {
    const sec = model.home.sections[si]!;
    push({
      id: `screen:home-section-${si}`,
      kind: "screen",
      screen: "home",
      label: `Home section: ${sec.title}`,
      text: `Home section "${sec.title}" — ${sec.items.length} listing card(s).`,
    });

    for (let i = 0; i < sec.items.length; i++) {
      const it = sec.items[i]!;
      const base = `home.sections[${si}].items[${i}]`;
      indexListItemFields({
        push,
        screen: "home",
        screenLabel: `Home · ${sec.title}`,
        basePath: base,
        item: it,
        cardIndex: i,
      });
      const badge = it.badge?.trim() || "none";
      const meta = it.meta?.trim() || "none";
      listingLines.push(
        `• ${base} "${it.title}" badge:${badge} meta:${meta}`
      );
    }
  }

  if (listingLines.length) {
    push({
      id: "listing-summary",
      kind: "item",
      screen: "home",
      label: "All Home listing cards",
      text:
        `Home walk listing cards (${listingLines.length}) — use home.sections[n].items[m].badge for status chips ` +
        `(Open, Matched, Done) and .meta for area/distance:\n${listingLines.slice(0, 12).join("\n")}`,
    });
  }

  push({
    id: "topic:listing-cards",
    kind: "flow",
    screen: "home",
    label: "Listing card editing",
    text:
      "Status chips on walk listing cards = home.sections[n].items[m].badge (values like Open, Matched, Done). " +
      "Area/distance on cards = .meta or .badge. Tab feed cards = tabScreens.{tabId}.items[m].badge.",
  });

  for (const tab of model.tabs) {
    const items = model.tabScreens[tab.id]?.items ?? [];
    push({
      id: `screen:${tab.id}`,
      kind: "screen",
      screen: tab.id,
      label: `${tab.label} tab`,
      text: `Tab "${tab.label}" (id: ${tab.id}) — ${items.length} card(s) in preview.`,
    });
    for (let i = 0; i < Math.min(items.length, 12); i++) {
      const it = items[i]!;
      indexListItemFields({
        push,
        screen: tab.id,
        screenLabel: tab.label,
        basePath: `tabScreens.${tab.id}.items[${i}]`,
        item: it,
        cardIndex: i,
      });
    }
  }

  push({
    id: "built-state",
    kind: "flow",
    screen: "preview",
    label: "What is already built",
    text: summarizeBuiltState(model),
  });

  const supabaseOn =
    Boolean(input.connectorState?.supabase) &&
    input.connectorState!.supabase!.status !== "disconnected";
  push({
    id: "connector:supabase",
    kind: "connector",
    screen: "connections",
    label: "Supabase",
    text: supabaseOn
      ? "Supabase is connected — email sign-in can work in preview; Google/Apple need provider setup."
      : "Supabase is NOT connected — sign-in and messaging need Connections → Connect Supabase.",
  });

  if (input.connectorNote?.trim()) {
    push({
      id: "connector:note",
      kind: "connector",
      screen: "connections",
      label: "Connections",
      text: input.connectorNote.trim(),
    });
  }

  for (const item of input.readinessItems ?? []) {
    push({
      id: `checklist:${item.id}`,
      kind: "checklist",
      screen: "checklist",
      label: item.title,
      text: `Checklist · ${item.title} (${item.status}): ${item.plainWhy}`,
    });
  }

  if (input.brainstormSummary?.trim()) {
    push({
      id: "memory:summary",
      kind: "memory",
      screen: "brainstorm",
      label: "Brainstorm summary",
      text: input.brainstormSummary.trim(),
    });
  }

  for (const [i, turn] of (input.brainstormHistory ?? []).slice(-4).entries()) {
    push({
      id: `memory:turn:${i}`,
      kind: "memory",
      screen: "brainstorm",
      label: turn.role === "user" ? "Founder said" : "Coach said",
      text: `${turn.role === "user" ? "Founder" : "Coach"}: ${turn.content.slice(0, 400)}`,
    });
  }

  for (const [i, turn] of (input.buildHistory ?? []).slice(-6).entries()) {
    push({
      id: `memory:build:${i}`,
      kind: "memory",
      screen: "build",
      label: turn.role === "user" ? "Build request" : "Build reply",
      text: `${turn.role === "user" ? "Founder (Build)" : "Build"}: ${turn.content.slice(0, 400)}`,
    });
  }

  for (const t of (input.interview ?? []).filter((x) => x.answer?.trim()).slice(-4)) {
    push({
      id: `memory:interview:${t.questionId}`,
      kind: "memory",
      screen: "interview",
      label: "Founder interview",
      text: `Interview — ${t.questionId}: ${t.answer!.trim()}`,
    });
  }

  return chunks;
}

export type RetrieveBuildContextOpts = {
  buildHistory?: BrainstormTurn[];
  topK?: number;
};

/** Retrieve top chunks for this Build message — keyword search + topic lock + pinned thread. */
export function retrieveBuildContext(
  query: string,
  chunks: BuildContextChunk[],
  topKOrOpts: number | RetrieveBuildContextOpts = 14
): BuildContextChunk[] {
  const opts: RetrieveBuildContextOpts =
    typeof topKOrOpts === "number" ? { topK: topKOrOpts } : topKOrOpts;
  const topK = opts.topK ?? 14;
  const buildHistory = opts.buildHistory ?? [];

  const expandedQuery = buildExpandedRetrievalQuery(query, buildHistory);
  const topic = detectRetrievalTopic(expandedQuery);
  const nMsg = norm(expandedQuery);
  const quotes = quotedPhrases(expandedQuery);

  const scored = chunks
    .map((chunk) => {
      let score =
        overlapScore(expandedQuery, chunk.text) +
        screenBoost(expandedQuery, chunk.screen, chunk.label) +
        topicScoreAdjust(chunk, topic);

      if (chunk.value) {
        const nVal = norm(chunk.value);
        if (nVal.length >= 6 && nMsg.includes(nVal)) score += 1.0;
        for (const w of words(chunk.value)) {
          if (w.length >= 5 && nMsg.includes(w)) score += 0.1;
        }
      }

      for (const q of quotes) {
        if (chunk.value && norm(q).length >= 4) {
          if (norm(chunk.value).includes(norm(q))) score += 0.9;
        }
        score += overlapScore(q, chunk.text) * 0.4;
      }

      if (chunk.kind === "item") score += 0.08;
      else if (chunk.kind === "copy" && (topic === "listing" || topic === "status")) {
        score -= 0.05;
      } else if (chunk.kind === "copy") score += 0.03;

      return { chunk, score };
    })
    .filter((r) => r.score >= 0.15)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.chunk);

  const pinIds = pinnedChunkIds(chunks, buildHistory, topic);
  const pinned = chunks.filter((c) => pinIds.has(c.id));

  return mergeRetrievedChunks(scored, pinned, Math.max(topK, pinned.length));
}

/** Format retrieved chunks for the Build agent prompt. */
export function formatRetrievedBuildContext(
  query: string,
  retrieved: BuildContextChunk[],
  buildHistory: BrainstormTurn[] = []
): string {
  if (!retrieved.length) {
    return `No strong match for: "${query.slice(0, 120)}". Use Build thread + listing-summary paths.`;
  }

  const sections: string[] = [
    `--- Retrieved for this request (most relevant first) ---`,
    `Query: ${query.trim()}`,
  ];

  const listingItems = retrieved.filter(
    (c) => c.kind === "item" && (c.path?.includes("home.sections") || c.id === "listing-summary")
  );
  const otherItems = retrieved.filter(
    (c) => c.kind === "item" && !listingItems.includes(c)
  );
  const copy = retrieved.filter((c) => c.kind === "copy");

  if (listingItems.length) {
    sections.push(
      "Listing cards (status chips = .badge, area = .meta):\n" +
        listingItems
          .map((c) => {
            const val = c.value ?? c.text.match(/"([^"]*)"/)?.[1] ?? "";
            return `• [${c.screen}] ${c.label} → "${val}" (${c.path})`;
          })
          .join("\n")
    );
  }

  if (otherItems.length) {
    sections.push(
      "Other card fields:\n" +
        otherItems
          .map((c) => `• [${c.screen}] ${c.label} → "${c.value ?? ""}" (${c.path})`)
          .join("\n")
    );
  }

  if (copy.length) {
    sections.push(
      "Flow copy:\n" +
        copy
          .map((c) => `• [${c.screen}] ${c.label} → "${c.value ?? ""}" (${c.path})`)
          .join("\n")
    );
  }

  const context = retrieved.filter(
    (c) => c.kind !== "copy" && c.kind !== "item"
  );
  if (context.length) {
    sections.push(
      "Context:\n" + context.map((c) => `• ${c.label}: ${c.text.slice(0, 280)}`).join("\n")
    );
  }

  const hasListingPaths = listingItems.some((c) => c.path?.includes("home.sections"));
  const threadNote = buildHistory.length
    ? "Build thread is active — continue that task; do not ask unrelated clarifying questions."
    : "";

  sections.push(
    "--- Instructions ---\n" +
      "Profile setup ('Tell us about you') = flow.setup* — NOT onboarding[n]. " +
      "Status chips on walk cards: set home.sections[n].items[m].badge to Open, Matched, or Done. " +
      "Structural ops: remove_role, owner_only, enable_setup_back. " +
      (hasListingPaths
        ? `Listing paths are retrieved — apply set ops on those badge/meta fields. ${threadNote}`
        : threadNote || "Use set ops on the paths above.")
  );

  return sections.join("\n\n");
}

/** Top copy target from the index — shared by smart copy + Kimi. */
export function topCopyTargetFromIndex(
  query: string,
  chunks: BuildContextChunk[]
): BuildContextChunk | null {
  const hit = retrieveBuildContext(query, chunks, 6).find((c) => c.path && c.value);
  return hit ?? null;
}

/** Verify the preview actually changed for what was asked. */
export function verifyBuildChange(
  query: string,
  before: ExpoAppModel,
  after: ExpoAppModel,
  changedPaths: string[]
): { ok: boolean; note?: string } {
  if (!changedPaths.length) {
    return { ok: false, note: "No preview fields changed." };
  }

  const q = query.toLowerCase();
  if (/simpl|shorter|brief|concise/.test(q)) {
    for (const path of changedPaths) {
      const b = getStringAtPath(before, path);
      const a = getStringAtPath(after, path);
      if (a.length >= b.length && b.length > 12) {
        return { ok: false, note: `"${path}" did not get shorter.` };
      }
    }
  }

  return { ok: true };
}
