import type { BrainstormTurn, InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import { coachBuiltStateBlock } from "./builtState";
import { isDeepBrainstormMessage } from "./brainstormContext";
import type { AppReadinessAudit, ReadinessItem } from "./readinessAudit";
import type { ExpoAppModel } from "./types";

export type BrainstormIntent =
  | "single_item"
  | "full_walkthrough"
  | "continuation"
  | "general";

/** One related checklist line max — keeps context tight. */
const RELATED_ITEM: Record<string, string> = {
  onboarding: "auth",
  auth: "backend",
  roles: "auth",
  backend: "auth",
  messaging: "backend",
  payments: "legal",
  legal: "landing",
};

export interface RetrievedBrainstormContext {
  intent: BrainstormIntent;
  focusItems: ReadinessItem[];
  spine: string;
  builtState: string;
  previewSnippets: string;
  interviewSnippet: string;
  continuingFrom: string | null;
  answerInstructions: string;
}

function detectIntent(
  message: string,
  history: BrainstormTurn[],
  pinned: ReadinessItem | null | undefined
): BrainstormIntent {
  const m = message.toLowerCase().trim();

  if (
    /what do i need for|what do i need to|tell me about|how do i|how should|what is|what's|explain .+ for/i.test(
      m
    )
  ) {
    return "single_item";
  }

  if (pinned && !isDeepBrainstormMessage(message, history)) {
    return "single_item";
  }

  if (isDeepBrainstormMessage(message, history)) {
    return "full_walkthrough";
  }

  if (
    m.length < 48 &&
    /^(yes|yeah|yep|sure|ok|okay|full|walk|deep|continue|go ahead|tell me more)/i.test(m)
  ) {
    return "continuation";
  }

  return "general";
}

function findItemsInMessage(message: string, items: ReadinessItem[]): ReadinessItem[] {
  const m = message.toLowerCase();
  return items.filter(
    (i) =>
      m.includes(i.title.toLowerCase()) ||
      m.includes(i.id) ||
      (i.id === "auth" && /sign[\s-]?in|sign[\s-]?up|account/i.test(m)) ||
      (i.id === "google-sign-in" && /google/i.test(m)) ||
      (i.id === "apple-sign-in" && /apple/i.test(m)) ||
      (i.id === "backend" && /supabase|database|data lives/i.test(m)) ||
      (i.id === "onboarding" && /onboarding|first.?launch|intro slide/i.test(m))
  );
}

function scoreBestItem(message: string, items: ReadinessItem[]): ReadinessItem | null {
  const m = message.toLowerCase();
  let best: ReadinessItem | null = null;
  let bestScore = 0;

  for (const item of items) {
    let score = 0;
    const title = item.title.toLowerCase();
    for (const word of title.split(/\s+/)) {
      if (word.length > 3 && m.includes(word)) score += 2;
    }
    if (item.priority === "launch_blocker") score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore >= 2 ? best : null;
}

function buildSpine(mp: MasterBuildPrompt, model: ExpoAppModel | null): string {
  const tabs = model?.tabs.map((t) => t.label).join(", ") ?? "core screens";
  const roles = model?.flow?.roles?.map((r) => r.label).join(" / ");
  return [
    `${mp.appName} — ${mp.description}`,
    `Audience: ${mp.audience}`,
    `Plan features: ${mp.features.slice(0, 5).join(", ") || "core flows"}`,
    `Preview tabs: ${tabs}`,
    roles ? `Role pick in app: ${roles}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function previewSnippetsForItems(model: ExpoAppModel, items: ReadinessItem[]): string {
  const lines: string[] = [];
  const ids = new Set(items.map((i) => i.id));

  if (ids.has("onboarding") && model.onboarding.length > 0) {
    const slides = model.onboarding
      .slice(0, 3)
      .map((s) => `"${s.title}"`)
      .join(", ");
    lines.push(`Onboarding slides in app design: ${slides}`);
  }

  if (ids.has("roles") && model.flow?.roles?.length) {
    lines.push(
      `Role picker in app design: ${model.flow.roles.map((r) => r.label).join(" / ")}`
    );
  }

  if (ids.has("messaging") && model.tabs.some((t) => /message|chat/i.test(t.label))) {
    const wired = Boolean(model.previewActions?.messagingTabId);
    lines.push(
      wired
        ? "Messaging is already wired in the preview — do not suggest adding a Messages tab again."
        : "Messages tab exists in preview — suggest wiring threads/backend if they want more, not adding from scratch."
    );
  }

  if (ids.has("auth")) {
    if (model.flow?.auth?.enabled) {
      lines.push(
        "Sign-up and sign-in are already in the preview — only discuss OAuth setup in Connections or production hardening."
      );
    } else {
      lines.push(
        "Recommend Google + Apple sign-in for launch; email is OK for preview testing with linked Supabase."
      );
    }
  }
  if (ids.has("google-sign-in")) {
    lines.push(
      "Google setup: Connections panel → Set up Google login — numbered steps with copy-paste redirect URL."
    );
  }
  if (ids.has("apple-sign-in")) {
    lines.push(
      "Apple setup: Connections → Set up Apple login — do before App Store; needs $99/yr Apple Developer."
    );
  }

  if (lines.length === 0) {
    lines.push(
      `Home headline: "${model.home.headline}". Hero: ${model.home.heroLabel}.`
    );
  }

  return lines.join("\n");
}

function formatFocusItem(item: ReadinessItem): string {
  const state =
    item.status === "have"
      ? "already in good shape"
      : item.status === "partial"
        ? "partially in preview only"
        : "not built yet";
  return `• ${item.title} (${state}) — ${item.plainWhy}${item.inPreview ? " [mocked in app design, not production]" : ""}`;
}

function answerInstructions(
  intent: BrainstormIntent,
  appName: string,
  focusItems: ReadinessItem[]
): string {
  const focus = focusItems[0]?.title ?? "their question";

  switch (intent) {
    case "single_item":
      return (
        `Answer ONLY about "${focus}" for ${appName}. ` +
        `Sound like a senior engineer brainstorming over coffee — specific, opinionated, no filler openers. ` +
        `Structure: (1) what the app design already includes for this — skip if listed under Already built (2) demo UI vs production-ready (3) what they'd still need to ship (4) one next step. ` +
        `Never say you see their screen or preview. Do NOT list other checklist items. ~120–180 words.`
      );
    case "full_walkthrough":
      return (
        `They want the full ship plan for ${appName} — but still conversational, not a dump. ` +
        `Walk through the retrieved launch blockers in priority order with 1–2 sentences each. ` +
        `End with what to tackle first. ~200 words max.`
      );
    case "continuation":
      return (
        `Continue the previous topic for ${appName}. Go deeper on what they were asking — ` +
        `specific to this app, engineer tone, no generic advice. ~150 words.`
      );
    default:
      return (
        `Answer their question about ${appName} specifically. Engineer brainstorm vibe. ` +
        `Under 120 words. No full checklist dump.`
      );
  }
}

export function retrieveBrainstormContext(
  message: string,
  history: BrainstormTurn[],
  mp: MasterBuildPrompt,
  model: ExpoAppModel | null,
  audit: AppReadinessAudit | null,
  interview: InterviewTurn[],
  pinned: ReadinessItem | null | undefined,
  summary?: string | null
): RetrievedBrainstormContext {
  const intent = detectIntent(message, history, pinned);
  const items = audit?.items ?? [];
  const focusItems: ReadinessItem[] = [];

  const fromMessage = findItemsInMessage(message, items);
  const fromPin = pinned ? [pinned] : [];

  if (intent === "full_walkthrough") {
    for (const item of items.filter((i) => i.priority === "launch_blocker").slice(0, 5)) {
      if (!focusItems.find((f) => f.id === item.id)) focusItems.push(item);
    }
  } else {
    for (const item of [...fromPin, ...fromMessage]) {
      if (!focusItems.find((f) => f.id === item.id)) focusItems.push(item);
    }
    if (focusItems.length === 0) {
      const best = scoreBestItem(message, items);
      if (best) focusItems.push(best);
    }
    if (focusItems.length === 0 && audit?.topGaps[0]) {
      focusItems.push(audit.topGaps[0]);
    }
    const relatedId = focusItems[0] ? RELATED_ITEM[focusItems[0].id] : undefined;
    if (relatedId && intent === "single_item") {
      const related = items.find((i) => i.id === relatedId);
      if (related && !focusItems.find((f) => f.id === related.id)) {
        focusItems.push(related);
      }
    }
  }

  const lastUser = [...history].reverse().find((t) => t.role === "user");
  const continuingFrom =
    intent === "continuation" && lastUser ? lastUser.content : null;

  const interviewSnippet = interview
    .slice(-3)
    .map((t) => `• ${t.answer}`)
    .join("\n");

  return {
    intent,
    focusItems,
    spine: buildSpine(mp, model),
    builtState: coachBuiltStateBlock(model),
    previewSnippets: model ? previewSnippetsForItems(model, focusItems) : "",
    interviewSnippet,
    continuingFrom,
    answerInstructions: answerInstructions(intent, mp.appName, focusItems),
  };
}

export function formatRetrievedContextForPrompt(
  retrieved: RetrievedBrainstormContext,
  summary?: string | null,
  connectorNote?: string | null
): string {
  const parts: string[] = [
    "--- App spine (always true) ---",
    retrieved.spine,
  ];

  if (connectorNote?.trim()) {
    parts.push("--- Connections (platform) ---", connectorNote.trim());
  }

  if (retrieved.builtState) {
    parts.push(retrieved.builtState);
  }

  if (summary?.trim()) {
    parts.push("--- Brainstorm memory ---", summary.trim());
  }

  if (retrieved.continuingFrom) {
    parts.push("--- Continuing this question ---", retrieved.continuingFrom);
  }

  if (retrieved.focusItems.length > 0) {
    parts.push(
      "--- ONLY use these checklist lines for this reply (do not mention others) ---",
      retrieved.focusItems.map(formatFocusItem).join("\n")
    );
  }

  if (retrieved.previewSnippets) {
    parts.push(
      "--- App design facts (you cannot see their screen — describe the plan, not their viewport) ---",
      retrieved.previewSnippets
    );
  }

  if (retrieved.interviewSnippet) {
    parts.push("--- User said in interview ---", retrieved.interviewSnippet);
  }

  parts.push("--- How to answer ---", retrieved.answerInstructions);

  return parts.join("\n\n");
}

function offlineOpener(seed: string, title: string, appName: string): string {
  const n = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 3;
  if (n === 0) return `**${title}** on ${appName}:`;
  if (n === 1) return `For ${appName}'s **${title}**:`;
  return `Re: **${title}** —`;
}

/** Grounded coach reply when the LLM is down — specific to retrieved context, not a full audit dump. */
export function composeOfflineCoachReply(
  retrieved: RetrievedBrainstormContext,
  appName: string
): string {
  const item = retrieved.focusItems[0];
  if (!item) {
    return (
      `For **${appName}**, most of what's mocked up so far is UI polish. ` +
      `Real launch work is usually sign-in (Google + Apple first), where data lives, and App Store basics. ` +
      `Pick a checklist item on the right or ask about one topic and I'll go deep.`
    );
  }

  const designBit = item.inPreview
    ? `The app design already mocks up **${item.title}** — demo UI only, not wired for production.`
    : `**${item.title}** isn't really in the app design yet.`;

  const statusLine =
    item.status === "have"
      ? "You're in decent shape here."
      : item.status === "partial"
        ? "You've got a start, but it's not shippable as-is."
        : "This still needs real work before launch.";

  const related = retrieved.focusItems[1];
  const relatedBit = related
    ? `\n\nHeads up — **${related.title}** ties into this (${related.plainWhy.toLowerCase()}).`
    : "";

  const nextStep =
    item.inPreview && item.status !== "have"
      ? `Next step: switch to **Build** to change the mockup, or we can plan what "real" ${item.title.toLowerCase()} looks like first.`
      : `Next step: sketch what ${item.title.toLowerCase()} should do for ${appName}, then wire it in Build or with your backend.`;

  return (
    `${offlineOpener(item.id, item.title, appName)}\n\n` +
    `${designBit} ${statusLine} ${item.plainWhy}\n\n` +
    `${nextStep}${relatedBit}`
  );
}

/** Reject canned templates — never show these to users. */
export function isGenericBrainstormReply(text: string): boolean {
  return (
    /^APP READINESS AUDIT/i.test(text) ||
    /^Checklist context for/i.test(text) ||
    /\[(have|partial|missing)\]/i.test(text) ||
    /\(launch_blocker\)/i.test(text) ||
    /here's the real picture for/i.test(text) ||
    /What's already solid in your preview/i.test(text) ||
    /Still to plan before the App Store/i.test(text) ||
    /Looks real in the app, but isn't production-ready/i.test(text) ||
    /Before you ship, most apps tackle/i.test(text) ||
    /you'?re looking at/i.test(text) ||
    /\byou see (those|the|those three)/i.test(text) ||
    /on your screen/i.test(text) ||
    /in the preview right now/i.test(text) ||
    TIRED_OPENER_RE.test(text.trim())
  );
}

const TIRED_OPENER_RE =
  /^(oh,?\s*i get it|here'?s the thing|yeah,?\s*i get it|got it,?)\b/i;
