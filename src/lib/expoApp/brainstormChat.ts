import { flashChatComplete } from "@/lib/flashChat";
import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import type { ReadinessItem } from "./readinessAudit";
import {
  auditAppReadiness,
  summarizeAuditForBrainstorm,
  summarizeModelForBrainstorm,
  type AppReadinessAudit,
} from "./readinessAudit";
import type { ExpoAppModel } from "./types";

export type BrainstormTurn = { role: "user" | "assistant"; content: string };

function systemPrompt(
  mp: MasterBuildPrompt,
  model: ExpoAppModel | null,
  audit: AppReadinessAudit | null,
  interview: InterviewTurn[],
  pinnedItem?: ReadinessItem | null
): string {
  const base =
    `You are Appable's app engineer for "${mp.appName}" — a ${mp.description} app for ${mp.audience}. ` +
    `Features in the plan: ${mp.features.slice(0, 8).join(", ") || "core flows"}. `;

  const engineer =
    "Brainstorm mode: you have reviewed their preview and a readiness audit. " +
    "Explain what they HAVE vs what is MISSING to ship a real app (accounts, database, payments, legal, landing page). " +
    "Distinguish 'looks real in preview' from 'works in production'. " +
    "Use plain language — no jargon without a one-line explanation (e.g. Supabase = where data is stored). " +
    "Prioritize launch blockers before nice-to-haves. " +
    "NEVER say you changed the app or wrote code — suggest switching to Build mode for preview tweaks. " +
    "Keep replies under 140 words unless they ask for a full walkthrough. Friendly and specific to THIS app.";

  if (!model || !audit) {
    return (
      base +
      engineer +
      " (No preview model yet — focus on plan and category best practices.)"
    );
  }

  return (
    base +
    engineer +
    "\n\n" +
    summarizeModelForBrainstorm(model) +
    "\n\n" +
    summarizeAuditForBrainstorm(audit) +
    (interview.length
      ? `\nInterview notes: ${interview
          .slice(-4)
          .map((t) => `${t.question} → ${t.answer}`)
          .join(" | ")}`
      : "") +
    (pinnedItem
      ? `\n\nUSER IS FOCUSED ON CHECKLIST ITEM: "${pinnedItem.title}" — ${pinnedItem.plainWhy} ` +
        `Answer mainly about this. If they say yes/later/skip, acknowledge their decision briefly.`
      : "")
  );
}

/** Cheap conversational brainstorm — no preview/code changes. */
export async function runBrainstormChat(
  mp: MasterBuildPrompt,
  history: BrainstormTurn[],
  message: string,
  options?: {
    model?: ExpoAppModel | null;
    interview?: InterviewTurn[];
    audit?: AppReadinessAudit | null;
    pinnedItem?: ReadinessItem | null;
  }
): Promise<string> {
  const model = options?.model ?? null;
  const interview = options?.interview ?? [];
  const audit =
    options?.audit ??
    (model ? auditAppReadiness(model, mp, interview) : null);

  const messages = [
    {
      role: "system" as const,
      content: systemPrompt(mp, model, audit, interview, options?.pinnedItem),
    },
    ...history.slice(-8).map((t) => ({
      role: t.role,
      content: t.content,
    })),
    { role: "user" as const, content: message },
  ];

  const { text } = await flashChatComplete(messages, {
    temperature: 0.65,
    maxTokens: 380,
    timeoutMs: 25_000,
  });

  const reply = text.trim();
  if (!reply) {
    return "Good question — want me to walk through what's missing before you ship, or focus on one feature?";
  }
  return reply.slice(0, 800);
}
