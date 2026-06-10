import { flashChatComplete } from "@/lib/flashChat";
import {
  brainstormCoachComplete,
  pickBrainstormModelTier,
  type BrainstormModelTier,
} from "./brainstormModel";
import { formatPreviewContextForBrainstorm } from "./previewBrainstormContext";
import type { PreviewBuildState } from "./previewBuildState";
import type {
  BrainstormBuildSuggestion,
  BrainstormTurn,
  InterviewTurn,
  MasterBuildPrompt,
} from "@/lib/types";
import { isDeepBrainstormMessage, parseBuildSuggestionJson } from "./brainstormContext";
import {
  composeOfflineCoachReply,
  formatRetrievedContextForPrompt,
  isGenericBrainstormReply,
  retrieveBrainstormContext,
} from "./brainstormRetrieve";
import { finalizeBrainstormWorkOrder } from "./brainstormWorkOrder";
import type { ReadinessItem } from "./readinessAudit";
import { auditAppReadiness, type AppReadinessAudit } from "./readinessAudit";
import type { ExpoAppModel } from "./types";
import { founderVoiceBlock } from "./founderVoice";
import {
  COACH_GUIDANCE_RULES,
  ensureBrainstormGuidanceClosing,
  resolvePreviewBuildSuggestion,
  shouldPersistPendingBuild,
} from "./brainstormGuidance";
import { isAdviceOnlyText, isBrainstormReadyToApply, NORMIE_COACH_RULES } from "./brainstormNormie";
import { resolveBuildHandoff } from "./buildHandoff";

export type { BrainstormTurn } from "@/lib/types";

export interface BrainstormChatResult {
  reply: string;
  buildSuggestion: BrainstormBuildSuggestion | null;
  summary: string;
}

const COACH_VOICE =
  "You are a senior mobile engineer brainstorming with a non-technical founder. " +
  "Warm, direct, opinionated — but no catchphrase crutches. " +
  "NEVER open with 'Oh I get it', 'Here's the thing', or similar filler — jump straight into the answer. " +
  "Vary how you start each reply; don't repeat the same opener twice in a row. " +
  "You NEVER changed their app. You NEVER dump full checklists or status reports. " +
  "You answer exactly what they asked, using only the retrieved context below. " +
  "Check **Already built in preview** — never tell them to add something that's already listed there. " +
  "You CANNOT see their phone or live preview — never say 'you're looking at', 'you see', " +
  "'those slides on your screen', or anything that implies a shared viewport. " +
  "Talk about what the **app design** includes vs what still needs real wiring. " +
  "Plain English — define jargon in one line. " +
  "Follow **INTEGRATION MARKETPLACE** and **INTEGRATION IMPLEMENTATION PLAYBOOKS** in context — explain how each fits THIS app; never auto-add integrations. " +
  "When explaining an integration, always start with whether they need to **create an account or log in** (give the site), then where to copy keys into **Integrations**. " +
  "**Brainstorm plans only** — you do NOT change the preview or run SQL. " +
  "**Build** executes: preview UI, Supabase tables (messaging, auth), and wiring. " +
  "Accounts/data → **Supabase** in Connections, then user switches to **Build** to wire sign-up + sign-in or messaging. " +
  "Paid features → **RevenueCat** after Supabase. Do not suggest RevenueCat for free apps. " +
  "Google + Apple sign-in guides live under Connections. Never paste API keys in chat. " +
  "**Copy & UX:** Coach copy like a senior product writer — quote the problem, propose exact replacement text in quotes, explain WHY for this app. " +
  "On follow-ups (shorter, simpler, clearer, who is this for): keep that structure — never collapse to just the quote. " +
  "When copy is finalized, tell them to tap **Apply to app** (or say yes) — do NOT ask 'Want to update?' again. " +
  "Reply briefly ONLY when the user confirms with yes/ok/do it — not when they ask for another draft. " +
  "Only mention integrations when they explicitly ask — never at the end of copy talk.\n\n" +
  NORMIE_COACH_RULES +
  "\n\n" +
  COACH_GUIDANCE_RULES;

const TIRED_OPENER_RE =
  /^(oh,?\s*i get it|here'?s the thing|yeah,?\s*i get it|got it,?)\b/i;

function tiredOpenersFromHistory(history: BrainstormTurn[]): string {
  const recent = history.filter((t) => t.role === "assistant").slice(-4);
  const used: string[] = [];
  for (const t of recent) {
    const head = t.content.trim().slice(0, 48);
    if (TIRED_OPENER_RE.test(head)) used.push(head.split(/[.!?\n]/)[0] ?? head);
  }
  if (used.length === 0) return "";
  return (
    "Recent replies already opened with filler (" +
    used.slice(0, 2).join("; ") +
    "). Start this reply with substance — no 'Oh I get it' / 'Here's the thing'."
  );
}

function stripTiredOpeners(text: string): string {
  let t = text.trim();
  for (let i = 0; i < 2; i++) {
    const next = t
      .replace(/^oh,?\s*i get it[.!—–-]*\s*/i, "")
      .replace(/^here'?s the thing[.:!—–-]*\s*/i, "")
      .replace(/^(yeah|got it),?\s*i get it[.!—–-]*\s*/i, "")
      .trim();
    if (next === t) break;
    t = next;
  }
  return t;
}

function buildSystemPrompt(
  mp: MasterBuildPrompt,
  retrievedContext: string,
  history: BrainstormTurn[]
): string {
  const openerHint = tiredOpenersFromHistory(history);
  return (
    `${COACH_VOICE}\n\n` +
    `${founderVoiceBlock(mp.appName)}\n\n` +
    `App: ${mp.appName}\n\n` +
    retrievedContext +
    (openerHint ? `\n\n--- Opener rule ---\n${openerHint}` : "")
  );
}

function buildMessages(
  system: string,
  history: BrainstormTurn[],
  userMessage: string
): { role: "system" | "user" | "assistant"; content: string }[] {
  return [
    { role: "system", content: system },
    ...history.slice(-8).map((t) => ({
      role: t.role,
      content: t.content,
    })),
    { role: "user", content: userMessage },
  ];
}

async function coachReply(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  longForm: boolean,
  tier: BrainstormModelTier
): Promise<string> {
  const { text } = await brainstormCoachComplete(messages, tier, longForm);
  return text;
}

async function refreshBrainstormSummary(
  mp: MasterBuildPrompt,
  priorSummary: string,
  userMessage: string,
  assistantReply: string
): Promise<string> {
  const { text } = await flashChatComplete(
    [
      {
        role: "system",
        content:
          `Update brainstorm notes for ${mp.appName}. Max 4 short bullets. ` +
          `Topics discussed, decisions, open questions. Plain text only.`,
      },
      {
        role: "user",
        content:
          `Previous:\n${priorSummary || "(empty)"}\n\n` +
          `User: ${userMessage}\nCoach: ${assistantReply}\n\nUpdated notes:`,
      },
    ],
    { temperature: 0.3, maxTokens: 200, timeoutMs: 15_000 }
  );

  const next = text.trim().slice(0, 500);
  return next || priorSummary;
}

async function detectBuildSuggestion(
  mp: MasterBuildPrompt,
  userMessage: string,
  assistantReply: string,
  previewModel: ExpoAppModel | null | undefined,
  history: BrainstormTurn[]
): Promise<BrainstormBuildSuggestion | null> {
  if (previewModel) {
    const workOrder = finalizeBrainstormWorkOrder({
      history,
      model: previewModel,
      appName: mp.appName,
      coachText: assistantReply,
      userMessage,
    });
    if (workOrder) return workOrder;
  }

  const { text } = await flashChatComplete(
    [
      {
        role: "system",
        content:
          `JSON only. Backend-only work (Supabase tables, legal, no preview UI copy)? ` +
          `{"suggest":false} OR {"suggest":true,"label":"Apply to app","prompt":"short backend instruction"}. ` +
          `suggest:false for preview copy — that is handled separately.`,
      },
      {
        role: "user",
        content: `User: ${userMessage}\nCoach: ${assistantReply}`,
      },
    ],
    { temperature: 0.2, maxTokens: 80, timeoutMs: 10_000 }
  );

  const suggestion = parseBuildSuggestionJson(text);
  if (!suggestion?.prompt) return null;
  if (/copy|subtitle|wording|headline|welcome|role picker|replace/i.test(suggestion.prompt)) {
    return null;
  }
  return suggestion;
}

/** Conversational brainstorm — Qwen only, retrieved context, no generic templates. */
export async function runBrainstormChat(
  mp: MasterBuildPrompt,
  history: BrainstormTurn[],
  message: string,
  options?: {
    model?: ExpoAppModel | null;
    interview?: InterviewTurn[];
    audit?: AppReadinessAudit | null;
    pinnedItem?: ReadinessItem | null;
    existingSummary?: string;
    connectorNote?: string;
    previewState?: PreviewBuildState;
    hasAttachments?: boolean;
  }
): Promise<BrainstormChatResult> {
  const previewModel = options?.model ?? null;
  const interview = options?.interview ?? [];
  const audit =
    options?.audit ??
    (previewModel ? auditAppReadiness(previewModel, mp, interview) : null);
  const pinned = options?.pinnedItem ?? null;
  const summary = options?.existingSummary ?? "";

  const retrieved = retrieveBrainstormContext(
    message,
    history,
    mp,
    previewModel,
    audit,
    interview,
    pinned,
    summary
  );

  const previewContext = formatPreviewContextForBrainstorm(
    options?.previewState,
    previewModel
  );
  const contextBlock = formatRetrievedContextForPrompt(
    retrieved,
    summary,
    options?.connectorNote,
    previewContext
  );
  const system = buildSystemPrompt(mp, contextBlock, history);
  const longForm =
    retrieved.intent === "full_walkthrough" ||
    retrieved.intent === "copy_coaching" ||
    isDeepBrainstormMessage(message, history);

  const messages = buildMessages(system, history, message.trim());
  const modelTier = pickBrainstormModelTier(message, history, retrieved.intent, {
    hasAttachments: options?.hasAttachments,
  });

  let reply = await coachReply(messages, longForm, modelTier);

  if (!reply || isGenericBrainstormReply(reply)) {
    reply = await coachReply(
      buildMessages(
        system +
          "\n\nYour last reply was rejected — too generic, a checklist dump, or implied you can see their screen. " +
          `Reply again: ONLY about "${retrieved.tapScope?.target.label ?? retrieved.focusItems[0]?.title ?? message}" for ${mp.appName}. ` +
          "Refer to the app design / build plan — never 'you're looking at'. Engineer coffee-chat tone.",
        history,
        message.trim()
      ),
      longForm,
      modelTier
    );
  }

  if (!reply || isGenericBrainstormReply(reply)) {
    reply = composeOfflineCoachReply(retrieved, mp.appName);
  }

  reply = stripTiredOpeners(reply).slice(0, 1200);

  if (isAdviceOnlyText(reply) && retrieved.intent !== "full_walkthrough") {
    const { text: shorter } = await flashChatComplete(
      [
        {
          role: "system",
          content:
            `Rewrite for a non-technical founder. Max 4 short sentences. ` +
            `One recommendation, then offer implement-now (say yes) OR go deeper. ` +
            `No numbered lists. No PostGIS/Haversine/schema-only next steps. ` +
            `App: ${mp.appName}`,
        },
        { role: "user", content: reply },
      ],
      { temperature: 0.5, maxTokens: 220, timeoutMs: 25_000 }
    );
    if (shorter.trim().length >= 40) {
      reply = shorter.trim();
    }
  }

  reply = ensureBrainstormGuidanceClosing(reply, message, mp.appName, retrieved.intent);

  const previewSuggestion = resolvePreviewBuildSuggestion(message, reply, mp.appName);

  const [nextSummary, detectedSuggestion] = await Promise.all([
    refreshBrainstormSummary(mp, summary, message, reply),
    previewSuggestion
      ? Promise.resolve(null)
      : detectBuildSuggestion(mp, message, reply, previewModel, history),
  ]);

  const buildSuggestion = previewSuggestion ?? detectedSuggestion;

  const threadAfter: BrainstormTurn[] = [
    ...history,
    { role: "user", content: message },
    { role: "assistant", content: reply },
  ];
  const handoff = resolveBuildHandoff({
    history: threadAfter,
    pendingBuild: buildSuggestion,
    model: previewModel,
    appName: mp.appName,
  });
  const applyReady = isBrainstormReadyToApply(handoff, buildSuggestion, threadAfter);
  const gatedSuggestion = shouldPersistPendingBuild(buildSuggestion, reply, applyReady)
    ? buildSuggestion
    : null;

  return { reply, buildSuggestion: gatedSuggestion, summary: nextSummary };
}
