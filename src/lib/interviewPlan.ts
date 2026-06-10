import { answerFor } from "@/lib/interviewHelpers";
import type { InterviewStep } from "@/lib/interviewFlow";

const SPINE_STEPS: Record<"audience" | "features" | "name" | "colors", InterviewStep> = {
  audience: { id: "audience", prompt: "Who is it for?", kind: "text" },
  features: {
    id: "features",
    prompt: "What are 2–3 main things it does?",
    kind: "text",
  },
  name: { id: "name", prompt: "What do you want to call it?", kind: "text" },
  colors: {
    id: "colors",
    prompt: "Pick a palette — or type your own.",
    kind: "choice",
    options: [],
  },
};
import {
  isPoolStepId,
  resolvePoolStep,
  selectPoolQuestionsSync,
  type PoolQuestionId,
} from "@/lib/interviewQuestionPool";
import { mentionsAudienceInIdea } from "@/lib/interviewUnderstanding";
import type { InterviewTurn } from "@/lib/types";

const AUDIENCE_IDS = new Set([
  "audience",
  "pool_who",
  "followup_clarify_audience",
]);

const FEATURE_IDS = new Set([
  "features",
  "pool_core_loop",
  "pool_rules",
  "pool_proof",
  "followup_features",
  "followup_recipe_depth",
  "followup_clarify_features",
]);

export function hasAudienceAnswer(interview: InterviewTurn[]): boolean {
  if (mentionsAudienceInIdea(answerFor(interview, "idea"))) return true;
  return [...AUDIENCE_IDS].some((id) => answerFor(interview, id).trim().length > 2);
}

export function hasFeaturesAnswer(interview: InterviewTurn[]): boolean {
  // Only explicit answers count — keywords in the idea (track, streak, etc.) are not enough.
  return [...FEATURE_IDS].some((id) => answerFor(interview, id).trim().length > 2);
}

export function resolvedAudience(interview: InterviewTurn[]): string {
  for (const id of ["audience", "pool_who", "followup_clarify_audience"] as const) {
    const a = answerFor(interview, id).trim();
    if (a) return a;
  }
  return "";
}

export function resolvedFeatures(interview: InterviewTurn[]): string {
  const parts: string[] = [];
  for (const id of [
    "features",
    "pool_core_loop",
    "pool_rules",
    "pool_proof",
    "followup_features",
    "followup_recipe_depth",
    "followup_clarify_features",
  ] as const) {
    const a = answerFor(interview, id).trim();
    if (a) parts.push(a);
  }
  return parts.join("; ");
}

export function remainingPoolPlan(
  interview: InterviewTurn[],
  storedPlan?: PoolQuestionId[] | null
): PoolQuestionId[] {
  const plan =
    storedPlan && storedPlan.length > 0
      ? storedPlan
      : selectPoolQuestionsSync(interview);
  return plan.filter((id) => !answerFor(interview, id).trim());
}

export function nextSpineGapStep(interview: InterviewTurn[]): InterviewStep | null {
  if (!hasAudienceAnswer(interview)) return SPINE_STEPS.audience;
  if (!hasFeaturesAnswer(interview)) return SPINE_STEPS.features;
  if (!answerFor(interview, "name").trim()) return SPINE_STEPS.name;
  if (!answerFor(interview, "colors").trim()) return SPINE_STEPS.colors;
  return null;
}

export function resolveAdaptiveNextStep(
  interview: InterviewTurn[],
  answeredId: string,
  storedPlan?: PoolQuestionId[] | null
): InterviewStep | null {
  if (answeredId === "colors") return null;
  if (answeredId === "name") return SPINE_STEPS.colors;

  const poolRemaining = remainingPoolPlan(interview, storedPlan);

  if (answeredId === "idea" || isPoolStepId(answeredId)) {
    if (poolRemaining.length > 0) {
      return resolvePoolStep(poolRemaining[0], interview) as InterviewStep;
    }
    return nextSpineGapStep(interview);
  }

  if (answeredId.startsWith("followup_")) {
    return nextSpineGapStep(interview);
  }

  if (answeredId === "audience" || answeredId === "features") {
    return nextSpineGapStep(interview);
  }

  return nextSpineGapStep(interview);
}

/** Ordered steps for this interview (for progress bar). */
export function buildInterviewSequence(
  interview: InterviewTurn[],
  storedPlan?: PoolQuestionId[] | null
): string[] {
  const plan =
    storedPlan && storedPlan.length > 0
      ? storedPlan
      : selectPoolQuestionsSync(interview);
  const seq: string[] = ["idea", ...plan];
  if (!hasAudienceAnswer(interview) && !plan.includes("pool_who")) {
    seq.push("audience");
  }
  if (!hasFeaturesAnswer(interview) && !plan.includes("pool_core_loop")) {
    seq.push("features");
  }
  seq.push("name", "colors");
  return seq;
}

export function estimateInterviewProgress(
  interview: InterviewTurn[],
  activeStepId: string,
  storedPlan?: PoolQuestionId[] | null
): { current: number; total: number } {
  const seq = buildInterviewSequence(interview, storedPlan);
  const total = seq.length;
  let current = seq.indexOf(activeStepId);
  if (current < 0) {
    const answered = seq.filter((id) => {
      if (id === "idea") return Boolean(answerFor(interview, "idea").trim());
      if (id === "audience") return hasAudienceAnswer(interview);
      if (id === "features") return hasFeaturesAnswer(interview);
      if (id === "name") return Boolean(answerFor(interview, "name").trim());
      if (id === "colors") return Boolean(answerFor(interview, "colors").trim());
      return Boolean(answerFor(interview, id).trim());
    }).length;
    current = Math.min(answered + 1, total);
  } else {
    current += 1;
  }
  return { current: Math.max(1, current), total: Math.max(3, total) };
}
