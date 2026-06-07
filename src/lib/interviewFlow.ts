import { answerFor } from "@/lib/interviewHelpers";
import type { InterviewTurn } from "@/lib/types";

import {
  DYNAMIC_ANCHOR,
  isDynamicStepId,
  resolveDynamicStep,
  suggestDynamicFollowUp,
} from "@/lib/dynamicInterview";

export type InterviewStepId =
  | "idea"
  | "audience"
  | "features"
  | "name"
  | "colors"
  | "followup_idea"
  | "followup_features"
  | "followup_recipe_depth";

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
  if (isDynamicStepId(stepId)) {
    return resolveDynamicStep(stepId, interview) as InterviewStep;
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
  answeredId: InterviewStepId
): InterviewStep | null {
  const answer = answerFor(interview, answeredId);

  if (isDynamicStepId(answeredId)) {
    const anchor = DYNAMIC_ANCHOR[answeredId];
    return getNextSpineStep(interview, anchor);
  }

  const dynamic = suggestDynamicFollowUp(interview, answeredId, answer);
  if (dynamic) return dynamic as InterviewStep;

  return getNextSpineStep(interview, answeredId);
}

export function isInterviewDone(
  interview: InterviewTurn[],
  lastAnsweredId: InterviewStepId
): boolean {
  return resolveNextStep(interview, lastAnsweredId) === null;
}

export function getProgress(
  interview: InterviewTurn[],
  activeStepId: InterviewStepId
): { current: number; total: number; path: InterviewPath } {
  const spine = FULL_STEPS;
  const dynamicAnswered = interview.filter((t) =>
    isDynamicStepId(t.questionId)
  ).length;
  const total = spine.length + Math.min(2, dynamicAnswered + 1);

  let current = 1;
  if (isDynamicStepId(activeStepId)) {
    const anchor = DYNAMIC_ANCHOR[activeStepId];
    const anchorIdx = spine.findIndex((s) => s.id === anchor);
    current = anchorIdx + 2 + dynamicAnswered;
  } else {
    const idx = spine.findIndex((s) => s.id === activeStepId);
    current = Math.max(1, idx + 1 + dynamicAnswered);
  }

  return {
    current: Math.min(current, total),
    total,
    path: "full",
  };
}

/** @deprecated Reference cloning path removed — always false. */
export function isReferencePath(_interview: InterviewTurn[]): boolean {
  return false;
}

/** Next spine step when `idea` was already answered on the landing page. */
export function initialInterviewStep(interview: InterviewTurn[]): InterviewStep {
  if (answerFor(interview, "idea")) {
    return resolveNextStep(interview, "idea") ?? FULL_STEPS[1];
  }
  return INTERVIEW_START;
}
