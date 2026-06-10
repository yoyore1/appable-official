import type { BrainstormTurn } from "@/lib/types";
import { isGenericBuildFollowUp } from "./buildChatContext";
import type { BuildContextChunk } from "./buildContext";

export type RetrievalTopic =
  | "listing"
  | "status"
  | "distance"
  | "copy"
  | "role"
  | "general";

const SYNONYM_RULES: { re: RegExp; extra: string }[] = [
  { re: /\bchip(s)?\b/i, extra: "status badge statusBadge listing card" },
  { re: /\bstatus\b/i, extra: "badge chip open matched done listing card" },
  { re: /\blisting(s)?\b/i, extra: "walk card feed item home sections" },
  { re: /\bwalk card(s)?\b/i, extra: "listing home sections tab items" },
  { re: /\bdistance\b/i, extra: "meta badge neighborhood near you area" },
  { re: /\bnear you\b/i, extra: "meta badge neighborhood distance listing" },
  { re: /\bneighborhood\b/i, extra: "meta badge area listing card" },
  { re: /\bopen\b.*\bmatched\b|\bmatched\b.*\bdone\b/i, extra: "status badge chip listing" },
];

export function expandRetrievalSynonyms(query: string): string {
  let out = query;
  for (const rule of SYNONYM_RULES) {
    if (rule.re.test(query)) out += ` ${rule.extra}`;
  }
  return out.trim();
}

export function buildExpandedRetrievalQuery(
  message: string,
  buildHistory: BrainstormTurn[]
): string {
  const trimmed = message.trim();
  const parts: string[] = [];

  if (buildHistory.length) {
    const threadBlob = buildHistory
      .slice(-4)
      .map((t) => t.content)
      .join(" ");
    parts.push(threadBlob);
  }

  if (isGenericBuildFollowUp(trimmed) && buildHistory.length) {
    const lastUser = [...buildHistory].reverse().find((t) => t.role === "user");
    if (lastUser && lastUser.content !== trimmed) {
      parts.push(lastUser.content);
    }
  }

  parts.push(trimmed);
  return expandRetrievalSynonyms(parts.join(" ").trim());
}

export function detectRetrievalTopic(query: string): RetrievalTopic {
  const q = query.toLowerCase();

  if (/status chip|colored chip|open.{0,20}matched|matched.{0,20}done|three simple states/.test(q)) {
    return "status";
  }
  if (/listing|walk card|feed card|home tab.{0,30}card|card(s)? on home/.test(q)) {
    return "listing";
  }
  if (/distance|near you|neighborhood|miles?.away|area label|zip code/.test(q)) {
    return "distance";
  }
  if (/role picker|dog owner|dog walker|welcome subtitle|sign-?in|headline|wording|copy/.test(q)) {
    return "copy";
  }
  if (/owner.?only|two.?sided|remove walker|single role/.test(q)) {
    return "role";
  }
  if (/badge|chip|sections\.|tabScreens\./.test(q)) {
    return "listing";
  }

  return "general";
}

export function topicScoreAdjust(
  chunk: BuildContextChunk,
  topic: RetrievalTopic
): number {
  const path = chunk.path ?? "";
  const screen = chunk.screen;
  const kind = chunk.kind;
  const label = chunk.label.toLowerCase();
  const text = chunk.text.toLowerCase();

  if (topic === "listing" || topic === "status" || topic === "distance") {
    if (path.includes("home.sections") || path.includes("tabScreens")) {
      if (kind === "item" || chunk.id === "listing-summary") return 0.55;
    }
    if (chunk.id.startsWith("topic:listing")) return 0.5;
    if (screen === "home" && kind === "screen") return 0.35;
    if (path.includes("flow.roles") || label.includes("role description")) return -0.45;
    if (path.includes("welcomeSubtitle") || path.includes("signInSubtitle")) return -0.35;
    if (kind === "copy" && !path.includes("home.")) return -0.2;
  }

  if (topic === "copy" || topic === "role") {
    if (path.includes("flow.roles") || path.includes("welcome")) return 0.35;
    if (path.includes("home.sections") && kind === "item") return -0.15;
  }

  if (topic === "status" && (label.includes("badge") || text.includes("status"))) {
    return 0.4;
  }

  if (topic === "distance" && (label.includes("meta") || label.includes("badge"))) {
    return 0.35;
  }

  if (chunk.id.startsWith("memory:build:")) return 0.25;

  return 0;
}

export function pinnedChunkIds(
  chunks: BuildContextChunk[],
  buildHistory: BrainstormTurn[],
  topic: RetrievalTopic
): Set<string> {
  const ids = new Set<string>();

  if (!buildHistory.length) return ids;

  for (const c of chunks) {
    if (c.id.startsWith("memory:build:")) ids.add(c.id);
  }

  ids.add("listing-summary");

  if (topic === "listing" || topic === "status" || topic === "distance") {
    ids.add("topic:listing-cards");
    const homeItems = chunks.filter(
      (c) => c.path?.includes("home.sections") && c.kind === "item"
    );
    for (const c of homeItems.slice(0, 16)) {
      ids.add(c.id);
    }
  }

  return ids;
}

export function mergeRetrievedChunks(
  scored: BuildContextChunk[],
  pinned: BuildContextChunk[],
  topK: number
): BuildContextChunk[] {
  const out: BuildContextChunk[] = [];
  const seen = new Set<string>();

  for (const c of pinned) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }

  for (const c of scored) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
    if (out.length >= topK) break;
  }

  return out;
}
