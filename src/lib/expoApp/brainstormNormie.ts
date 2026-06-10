import type { BrainstormBuildSuggestion, BrainstormTurn } from "@/lib/types";
import {
  coachInvitesImplementation,
  inferPlanningPreviewOffer,
} from "./brainstormGuidance";
import { isCoachBuildReady } from "./brainstormWorkOrder";
import type { BrainstormApplyHandoff } from "./brainstormApply";
import { buildAppliedChatReply } from "./buildReply";
import { parseCoachReplacement } from "./tapCopyHandoff";

/** System prompt block — normie surface voice (technical detail stays in retrieved context). */
export const NORMIE_COACH_RULES =
  "NORMIE-FIRST REPLY RULES:\n" +
  "- First 2–4 sentences must be plain English any founder understands — no jargon wall.\n" +
  "- Give ONE clear recommendation for THIS app.\n" +
  "- Do NOT open with numbered architecture lists (no '1) Supabase schema 2) Permissions…').\n" +
  "- Avoid stack vocabulary in the main reply (PostGIS, Haversine, float8, edge function) — say 'location in your database' instead.\n" +
  "- For 'what do I need' questions: preview vs real app in simple terms, not an engineering spec.\n" +
  "- You plan in chat; saying **yes** or the Apply button runs the preview change.\n" +
  "- Never end on backend-only homework — always offer implement-now OR go deeper.";

const TECH_ADVICE_RE =
  /\b(postgis|haversine|float8|lat\/long|edge function|sender_id|oauth|webhook secret|api key)\b/i;

/** Coach reply looks like an architecture doc, not a cofounder chat. */
export function isAdviceOnlyText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const numbered = (t.match(/(?:^|\n)\s*\d+[.)]\s+/g) ?? []).length;
  if (numbered >= 3 && TECH_ADVICE_RE.test(t)) return true;
  if (t.length > 520 && numbered >= 2 && TECH_ADVICE_RE.test(t)) return true;
  return false;
}

function lastAssistantContent(history: BrainstormTurn[]): string {
  return [...history].reverse().find((turn) => turn.role === "assistant")?.content ?? "";
}

/**
 * Apply is only offered when Build has a real work order — not for research / checklist essays.
 */
export function isBrainstormReadyToApply(
  handoff: BrainstormApplyHandoff | null,
  pendingBuild: BrainstormBuildSuggestion | null,
  history: BrainstormTurn[]
): boolean {
  if (handoff?.patches?.length) return true;
  if (pendingBuild?.patches?.length) return true;

  const intent = handoff?.intent ?? pendingBuild?.intent;
  if (intent === "messaging" || intent === "auth" || intent === "sign_out") {
    return true;
  }

  const lastCoach = lastAssistantContent(history);
  if (isCoachBuildReady(lastCoach) && parseCoachReplacement(lastCoach)) {
    return true;
  }

  if (
    pendingBuild?.prompt?.trim() &&
    pendingBuild.intent &&
    pendingBuild.intent !== "generic" &&
    pendingBuild.prompt.length < 160
  ) {
    return true;
  }

  const lastUser = [...history].reverse().find((t) => t.role === "user")?.content ?? "";
  if (
    pendingBuild?.prompt?.trim() &&
    coachInvitesImplementation(lastCoach) &&
    inferPlanningPreviewOffer(lastUser, lastCoach, "")
  ) {
    return true;
  }

  return false;
}

/** Cursor-style apply reply — no lecture. */
export function formatNormieApplyReply(
  reply: string,
  modelChanged: boolean
): string {
  if (modelChanged) return buildAppliedChatReply();
  const trimmed = reply.trim();
  if (!trimmed || isAdviceOnlyText(trimmed) || trimmed.length > 200) {
    return "Couldn't apply that — tap the line or name the screen.";
  }
  return trimmed;
}
