import { flashChatComplete } from "@/lib/flashChat";
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
import { isBackendBuildRequest } from "./applyTweak";
import { buildCopyUpdateFromCoach } from "./resolveBuildIntent";
import type { ReadinessItem } from "./readinessAudit";
import { auditAppReadiness, type AppReadinessAudit } from "./readinessAudit";
import type { ExpoAppModel } from "./types";
import { founderVoiceBlock } from "./founderVoice";

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
  "Google + Apple sign-in guides live under Connections. Never paste API keys in chat.";

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
  longForm: boolean
): Promise<string> {
  const { text } = await flashChatComplete(messages, {
    temperature: 0.78,
    maxTokens: longForm ? 650 : 450,
    timeoutMs: longForm ? 40_000 : 30_000,
  });
  return text.trim();
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
  assistantReply: string
): Promise<BrainstormBuildSuggestion | null> {
  const { text } = await flashChatComplete(
    [
      {
        role: "system",
        content:
          `JSON only. Does the coach reply tell the user to switch to Build for a CONCRETE preview/UI change in ${mp.appName}? ` +
          `{"suggest":false} OR {"suggest":true,"label":"short","prompt":"build instruction from THIS exchange only"}. ` +
          `suggest:false if user only said yes/ok, or topic is backend/legal/database/Supabase only. ` +
          `prompt must match what was just discussed — never a different checklist item.`,
      },
      {
        role: "user",
        content: `User: ${userMessage}\nCoach: ${assistantReply}`,
      },
    ],
    { temperature: 0.2, maxTokens: 100, timeoutMs: 12_000 }
  );

  const suggestion = parseBuildSuggestionJson(text);
  if (suggestion && isBackendBuildRequest(suggestion.prompt)) return null;

  if (!suggestion?.suggest) {
    const copyPrompt = buildCopyUpdateFromCoach(assistantReply);
    if (copyPrompt && /ready to update|switch to build|build (mode|tab)|update the (onboarding|copy|preview)/i.test(assistantReply)) {
      return {
        suggest: true,
        label: "Update copy",
        prompt: copyPrompt,
      };
    }
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

  const contextBlock = formatRetrievedContextForPrompt(
    retrieved,
    summary,
    options?.connectorNote
  );
  const system = buildSystemPrompt(mp, contextBlock, history);
  const longForm =
    retrieved.intent === "full_walkthrough" ||
    isDeepBrainstormMessage(message, history);

  const messages = buildMessages(system, history, message.trim());

  let reply = await coachReply(messages, longForm);

  if (!reply || isGenericBrainstormReply(reply)) {
    reply = await coachReply(
      buildMessages(
        system +
          "\n\nYour last reply was rejected — too generic, a checklist dump, or implied you can see their screen. " +
          `Reply again: ONLY about "${retrieved.focusItems[0]?.title ?? message}" for ${mp.appName}. ` +
          "Refer to the app design / build plan — never 'you're looking at'. Engineer coffee-chat tone.",
        history,
        message.trim()
      ),
      longForm
    );
  }

  if (!reply || isGenericBrainstormReply(reply)) {
    reply = composeOfflineCoachReply(retrieved, mp.appName);
  }

  reply = stripTiredOpeners(reply).slice(0, 1200);

  const [nextSummary, buildSuggestion] = await Promise.all([
    refreshBrainstormSummary(mp, summary, message, reply),
    detectBuildSuggestion(mp, message, reply),
  ]);

  return { reply, buildSuggestion, summary: nextSummary };
}
