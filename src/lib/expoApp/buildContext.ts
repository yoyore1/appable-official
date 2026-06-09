import type { BrainstormTurn, InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import type { ProjectConnectorState } from "@/lib/connectors/registry";
import { summarizeBuiltState } from "./builtState";
import { listEditableCopyFields } from "./previewCopyFields";
import type { ReadinessItem } from "./readinessAudit";
import type { ExpoAppModel } from "./types";
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
  { re: /\bsetup|profile\s+setup|wizard\b/i, screens: ["setup"] },
  { re: /\bhome\b/i, screens: ["home"] },
  { re: /\bprofile\b/i, screens: ["profile"] },
  { re: /\bmessages?|chat|inbox\b/i, screens: ["messages"] },
];

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
  const re = /["']([^"']{4,})["']/g;
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

  for (const tab of model.tabs) {
    const items = model.tabScreens[tab.id]?.items ?? [];
    push({
      id: `screen:${tab.id}`,
      kind: "screen",
      screen: tab.id,
      label: `${tab.label} tab`,
      text: `Tab "${tab.label}" (id: ${tab.id}) — ${items.length} card(s) in preview.`,
    });
    for (let i = 0; i < Math.min(items.length, 8); i++) {
      const it = items[i]!;
      const base = `tabScreens.${tab.id}.items[${i}]`;
      const fields: { key: string; val?: string }[] = [
        { key: "title", val: it.title },
        { key: "subtitle", val: it.subtitle },
        { key: "primaryAction", val: it.primaryAction },
        { key: "badge", val: it.badge },
        { key: "meta", val: it.meta },
      ];
      for (const f of fields) {
        if (!f.val?.trim()) continue;
        const path = `${base}.${f.key}`;
        push({
          id: `item:${path}`,
          kind: "item",
          screen: tab.id,
          label: `${tab.label} card ${i + 1} ${f.key}`,
          path,
          value: f.val,
          text: `${tab.label} tab · card ${i + 1} ${f.key}: "${f.val}" [path: ${path}]`,
        });
      }
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

  for (const [i, turn] of (input.brainstormHistory ?? []).slice(-6).entries()) {
    push({
      id: `memory:turn:${i}`,
      kind: "memory",
      screen: "brainstorm",
      label: turn.role === "user" ? "Founder said" : "Coach said",
      text: `${turn.role === "user" ? "Founder" : "Coach"}: ${turn.content.slice(0, 400)}`,
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

/** Retrieve top chunks for this Build message — Cursor-style semantic-ish search. */
export function retrieveBuildContext(
  query: string,
  chunks: BuildContextChunk[],
  topK = 14
): BuildContextChunk[] {
  const nMsg = norm(query);
  const quotes = quotedPhrases(query);

  return chunks
    .map((chunk) => {
      let score = overlapScore(query, chunk.text) + screenBoost(query, chunk.screen, chunk.label);

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

      if (chunk.kind === "copy" || chunk.kind === "item") score += 0.05;

      return { chunk, score };
    })
    .filter((r) => r.score >= 0.18)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((r) => r.chunk);
}

/** Format retrieved chunks for the Build agent prompt. */
export function formatRetrievedBuildContext(
  query: string,
  retrieved: BuildContextChunk[]
): string {
  if (!retrieved.length) {
    return `No strong match for: "${query.slice(0, 120)}". Search the preview index or ask which screen.`;
  }

  const sections: string[] = [
    `--- Retrieved for this request (most relevant first) ---`,
    `Query: ${query.trim()}`,
  ];

  const copy = retrieved.filter((c) => c.kind === "copy" || c.kind === "item");
  if (copy.length) {
    sections.push(
      "Editable lines:\n" +
        copy
          .map((c) => `• [${c.screen}] ${c.label} → "${c.value ?? ""}" (${c.path})`)
          .join("\n")
    );
  }

  const context = retrieved.filter((c) => c.kind !== "copy" && c.kind !== "item");
  if (context.length) {
    sections.push(
      "Context:\n" + context.map((c) => `• ${c.label}: ${c.text.slice(0, 280)}`).join("\n")
    );
  }

  sections.push(
    "--- Instructions ---\n" +
      "Use ONLY paths from editable lines above. Match screen hints (welcome = first screen, role picker, etc.). " +
      "If nothing fits, set ask with one clarifying question."
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
