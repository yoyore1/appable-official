import { answerFor } from "@/lib/interviewHelpers";
import type { InterviewTurn } from "@/lib/types";

import {
  isDynamicStepId,
  resolveDynamicStep,
} from "@/lib/dynamicInterview";
import { resolveAdaptiveNextStep, estimateInterviewProgress } from "@/lib/interviewPlan";
import { isPoolStepId, resolvePoolStep, type PoolQuestionId } from "@/lib/interviewQuestionPool";

export type InterviewStepId =
  | "idea"
  | "audience"
  | "features"
  | "name"
  | "colors"
  | "followup_idea"
  | "followup_features"
  | "followup_recipe_depth"
  | "followup_clarify_idea"
  | "followup_clarify_audience"
  | "followup_clarify_features"
  | "pool_who"
  | "pool_core_loop"
  | "pool_rules"
  | "pool_proof"
  | "pool_first_use";

export type InterviewPath = "full";

export interface InterviewStep {
  id: InterviewStepId;
  prompt: string;
  kind: "text" | "choice";
  options?: string[];
}

export const FULL_STEPS: InterviewStep[] = [
  {
    id: "idea",
    prompt: "What's your app idea?",
    kind: "text",
  },
  {
    id: "audience",
    prompt: "Who is it for?",
    kind: "text",
  },
  {
    id: "features",
    prompt: "What are 2–3 main things it does?",
    kind: "text",
  },
  {
    id: "name",
    prompt: "What do you want to call it?",
    kind: "text",
  },
  {
    id: "colors",
    prompt: "Pick a palette — or type your own.",
    kind: "choice",
    options: [],
  },
];

/** First question — shown on the landing hero. */
export const FIRST_INTERVIEW_QUESTION = FULL_STEPS[0];

export const INTERVIEW_START = FIRST_INTERVIEW_QUESTION;

export function resolveInterviewPath(_interview: InterviewTurn[]): InterviewPath {
  return "full";
}

export function getInterviewSteps(_interview?: InterviewTurn[]): InterviewStep[] {
  return FULL_STEPS;
}

export function getStepById(
  interview: InterviewTurn[],
  stepId: InterviewStepId
): InterviewStep | undefined {
  const spine = FULL_STEPS.find((s) => s.id === stepId);
  if (spine) return spine;
  if (isPoolStepId(stepId)) {
    return resolvePoolStep(stepId, interview) as InterviewStep;
  }
  if (isDynamicStepId(stepId)) {
    return resolveDynamicStep(
      stepId as import("@/lib/dynamicInterview").DynamicStepId,
      interview
    ) as InterviewStep;
  }
  return undefined;
}

export function getNextSpineStep(
  _interview: InterviewTurn[],
  currentId: InterviewStepId
): InterviewStep | null {
  const steps = FULL_STEPS;
  const idx = steps.findIndex((s) => s.id === currentId);
  if (idx < 0 || idx >= steps.length - 1) return null;
  return steps[idx + 1];
}

/** @deprecated Use resolveNextStep */
export function getNextStep(
  interview: InterviewTurn[],
  currentId: InterviewStepId
): InterviewStep | null {
  return resolveNextStep(interview, currentId);
}

export function resolveNextStep(
  interview: InterviewTurn[],
  answeredId: InterviewStepId,
  interviewPlan?: PoolQuestionId[] | null
): InterviewStep | null {
  return resolveAdaptiveNextStep(interview, answeredId, interviewPlan);
}

export function isInterviewDone(
  interview: InterviewTurn[],
  lastAnsweredId: InterviewStepId,
  interviewPlan?: PoolQuestionId[] | null
): boolean {
  return resolveNextStep(interview, lastAnsweredId, interviewPlan) === null;
}

export function getProgress(
  interview: InterviewTurn[],
  activeStepId: InterviewStepId,
  interviewPlan?: PoolQuestionId[] | null
): { current: number; total: number; path: InterviewPath } {
  const { current, total } = estimateInterviewProgress(
    interview,
    activeStepId,
    interviewPlan
  );
  return { current, total, path: "full" };
}

/** @deprecated Reference cloning path removed — always false. */
export function isReferencePath(_interview: InterviewTurn[]): boolean {
  return false;
}

/** Next spine step when `idea` was already answered on the landing page. */
export function initialInterviewStep(
  interview: InterviewTurn[],
  interviewPlan?: PoolQuestionId[] | null
): InterviewStep {
  if (answerFor(interview, "idea")) {
    return resolveNextStep(interview, "idea", interviewPlan) ?? FULL_STEPS[1];
  }
  return INTERVIEW_START;
}
