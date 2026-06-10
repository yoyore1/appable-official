import type { BrainstormBuildSuggestion, BrainstormTurn } from "@/lib/types";
import type { BrainstormIntent } from "./brainstormRetrieve";
import type { ReadinessItem } from "./readinessAudit";

/** Coach invited the founder to act (yes / apply / implement now). */
export function coachInvitesImplementation(coachReply: string): boolean {
  return /want me to|sketch (?:this|it)|say\s+\*\*yes\*\*|say yes|right now|tap \*\*apply to app\*\*|tap apply to app/i.test(
    coachReply
  );
}

/** Preview model JSON tweaks (listing cards, chips) — not repo file edits. */
export function isPreviewModelTweakRequest(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  return isPreviewUiTopic(m, m);
}

/** Preview UI work (cards, chips, labels) — not role-picker copy. */
export function isPreviewUiTopic(userMessage: string, coachReply: string): boolean {
  const blob = `${userMessage} ${coachReply}`.toLowerCase();
  return (
    /status chip|colored chip|three simple states|open.{0,24}matched|matched.{0,24}done/.test(
      blob
    ) ||
    /walk listing|listing card|walk card|on (the )?home tab/.test(blob) ||
    /neighborhood.{0,16}card|area label|miles?.away|near you/.test(blob) ||
    /sketch.{0,24}preview|show (them |it )?as colored|colored chips/.test(blob)
  );
}

export function coachInvitesGoDeeper(coachReply: string): boolean {
  return /go deeper|keep it simple|more to (?:nail|figure|unpack)/i.test(coachReply);
}

export function inferPreviewBuildPrompt(
  userMessage: string,
  coachReply: string,
  appName: string
): string | null {
  const blob = `${userMessage} ${coachReply}`.toLowerCase();

  if (
    /status chip|colored chip|open.{0,24}matched|matched.{0,24}done|three simple states/.test(
      blob
    )
  ) {
    return (
      `On each walk listing card on the Home tab, add a colored status chip showing ` +
      `Open, Matched, or Done so owners and walkers instantly see what they can act on.`
    );
  }

  if (
    /distance|miles?.away|near you|neighborhood|area label|zip code|geo/.test(blob) &&
    !/status chip|matched.{0,12}done/.test(blob)
  ) {
    return (
      `On each walk listing card in the preview, show a neighborhood or area label ` +
      `(e.g. "Brooklyn · near you") instead of leaving distance blank.`
    );
  }

  if (/headline|subtitle|welcome|role picker|wording|replace it with/i.test(blob)) {
    return (
      `Update the preview copy we just discussed for ${appName} — ` +
      `use the exact wording from brainstorm if quoted.`
    );
  }

  if (/sketch.{0,24}preview|preview right now|show (them |it )?on every/i.test(blob)) {
    return (
      `Make the visible Home-tab listing change we just discussed for ${appName} — ` +
      `match what the coach described in the last reply.`
    );
  }

  return null;
}

export function inferPlanningPreviewOffer(
  userMessage: string,
  coachReply: string,
  appName: string
): { label: string; prompt: string } | null {
  const prompt = inferPreviewBuildPrompt(userMessage, coachReply, appName);
  if (!prompt) return null;

  const blob = `${userMessage} ${coachReply}`.toLowerCase();
  let label = "Update preview now";

  if (/status chip|open.{0,24}matched|matched.{0,24}done|three simple states/.test(blob)) {
    label = "Add status chips on cards";
  } else if (/distance|miles?.away|near you|neighborhood|area label|zip code|geo/.test(blob)) {
    label = "Add area labels on cards";
  } else if (/headline|subtitle|welcome|role picker|wording/.test(blob)) {
    label = "Apply wording to preview";
  } else if (/sketch|preview right now/.test(blob)) {
    label = "Sketch it in preview";
  }

  return { label, prompt };
}

/** Guarantee every planning reply ends with a clear fork for normies. */
export function ensureBrainstormGuidanceClosing(
  reply: string,
  userMessage: string,
  appName: string,
  intent: BrainstormIntent
): string {
  const trimmed = reply.trim();
  if (!trimmed) return reply;

  if (coachInvitesImplementation(trimmed) || coachInvitesGoDeeper(trimmed)) {
    return trimmed;
  }

  const previewOffer = inferPlanningPreviewOffer(userMessage, trimmed, appName);

  if (
    previewOffer &&
    (intent === "single_item" || intent === "continuation" || intent === "general")
  ) {
    const blob = `${userMessage} ${trimmed}`.toLowerCase();
    const label = previewOffer.label.toLowerCase();
    const implementPhrase = label.includes("wording")
      ? "apply that wording in your preview"
      : label.includes("status chip")
        ? "add those status chips on each walk card in your preview"
        : label.includes("area")
          ? "add area labels on each listing card in your preview"
          : "sketch this in your preview";
    const deeperBit =
      /distance|location|gps|database|supabase|listing|neighborhood|geo/.test(blob)
        ? "Real GPS and your database are the deeper path — say **go deeper** if you want that walkthrough."
        : "Say **go deeper** if you want the full walkthrough first.";

    return `${trimmed}\n\nWant me to ${implementPhrase} right now? Say **yes**. ${deeperBit}`;
  }

  if (intent === "single_item" || intent === "continuation") {
    return (
      `${trimmed}\n\n` +
      `There's still more we can unpack on this — want me to **go deeper**, or **keep it simple** for launch?`
    );
  }

  return trimmed;
}

/** Current-turn preview work — always wins over stale copy patches from earlier chat. */
export function resolvePreviewBuildSuggestion(
  userMessage: string,
  coachReply: string,
  appName: string
): BrainstormBuildSuggestion | null {
  const offer = inferPlanningPreviewOffer(userMessage, coachReply, appName);
  if (!offer) return null;

  return {
    label: offer.label,
    prompt: offer.prompt,
    intent: "generic",
    patches: [],
  };
}

export function mergePreviewOfferSuggestion(
  existing: BrainstormBuildSuggestion | null,
  userMessage: string,
  coachReply: string,
  appName: string
): BrainstormBuildSuggestion | null {
  return resolvePreviewBuildSuggestion(userMessage, coachReply, appName) ?? existing;
}

export function shouldPersistPendingBuild(
  buildSuggestion: BrainstormBuildSuggestion | null,
  coachReply: string,
  applyReady: boolean
): boolean {
  if (!buildSuggestion?.prompt?.trim()) return false;
  if (applyReady) return true;
  return coachInvitesImplementation(coachReply);
}

export const COACH_GUIDANCE_RULES =
  "GUIDANCE (mandatory — last 1–2 sentences of EVERY reply):\n" +
  "- You are the guide. Never leave them hanging and never dump only backend steps.\n" +
  "- If a visible preview win exists: offer it first — " +
  '"Want me to [specific change] in your preview right now? Say **yes**." ' +
  "Mention **go deeper** only as the alternative for real backend/GPS work.\n" +
  "- If still planning / heavy backend: " +
  `"There's more to nail on [topic] — want me to **go deeper**, or **keep it simple** for launch?\n` +
  '- If copy is finalized: "Want me to apply that wording? Say **yes** or tap Apply to app."\n' +
  '- Do NOT end with only "add a Supabase column" — pair backend with preview path OR go deeper.';

/** Map planning topics to a readiness checklist row. */
export function inferChecklistItemForTopic(
  userMessage: string,
  coachReply: string,
  items: ReadinessItem[]
): ReadinessItem | null {
  const blob = `${userMessage} ${coachReply}`.toLowerCase();

  const rules: { re: RegExp; id: string }[] = [
    {
      re: /distance|location|geo|near you|listing|neighborhood|miles? away|lat|postgis|database|supabase|backend|server/,
      id: "backend",
    },
    { re: /messag|chat|inbox|conversation|thread/, id: "messaging" },
    { re: /sign[\s-]?(?:in|up)|auth|account|login|google|apple/, id: "auth" },
    { re: /payment|paywall|subscription|revenuecat|purchase/, id: "payments" },
    { re: /onboarding|welcome|first[- ]?run|role picker/, id: "onboarding" },
    { re: /legal|privacy|terms|delete account/, id: "legal" },
    { re: /landing|app store|aso|marketing|growth/, id: "growth" },
  ];

  for (const rule of rules) {
    if (!rule.re.test(blob)) continue;
    const item = items.find((i) => i.id === rule.id);
    if (item) return item;
  }

  return items.find((i) => i.priority === "launch_blocker" && i.status !== "have") ?? null;
}

export function resolveDiscussPinItem(
  message: string,
  items: ReadinessItem[]
): ReadinessItem | null {
  const m = message.toLowerCase();

  for (const item of items) {
    if (m.includes(item.title.toLowerCase())) return item;
  }

  const quoted = message.match(/what do i need (?:for|to)\s+["'“]([^"'”?]+)["'”]?/i);
  if (quoted?.[1]) {
    const title = quoted[1].trim().toLowerCase();
    const exact = items.find((i) => i.title.toLowerCase() === title);
    if (exact) return exact;
    const partial = items.find(
      (i) => title.includes(i.title.toLowerCase()) || i.title.toLowerCase().includes(title)
    );
    if (partial) return partial;
  }

  return inferChecklistItemForTopic(message, "", items);
}

export function lastUserMessage(history: BrainstormTurn[]): string {
  return [...history].reverse().find((t) => t.role === "user")?.content ?? "";
}

export function lastCoachReply(history: BrainstormTurn[]): string {
  return [...history].reverse().find((t) => t.role === "assistant")?.content ?? "";
}
