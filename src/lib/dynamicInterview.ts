import { answerFor } from "@/lib/interviewHelpers";
import type { InterviewTurn } from "@/lib/types";

export type DynamicStepId =
  | "followup_idea"
  | "followup_features"
  | "followup_recipe_depth";

export interface DynamicInterviewStep {
  id: DynamicStepId;
  prompt: string;
  kind: "text";
}

/** Contextual follow-ups — never replace the guaranteed spine. */
export const DYNAMIC_STEP_IDS = [
  "followup_idea",
  "followup_features",
  "followup_recipe_depth",
] as const;

export const DYNAMIC_STEP_DEFS: Record<DynamicStepId, DynamicInterviewStep> = {
  followup_idea: {
    id: "followup_idea",
    kind: "text",
    prompt:
      "Someone opens your app for the first time — what's the first thing they do, and what do they get out of it?",
  },
  followup_features: {
    id: "followup_features",
    kind: "text",
    prompt:
      "Walk me through the main thing — what happens from open to done? (e.g. they open the app → tap something → …)",
  },
  followup_recipe_depth: {
    id: "followup_recipe_depth",
    kind: "text",
    prompt:
      "For the recipes — full step-by-step with ingredients, or shorter quick ideas?",
  },
};

function firstFeatureFromAnswer(features: string): string {
  return features.split(/[,;]|\band\b/i)[0]?.trim() ?? "";
}

/** Friend-texting prompt — references what they already said when we can. */
export function personalizeDynamicPrompt(
  stepId: DynamicStepId,
  interview: InterviewTurn[]
): string {
  if (stepId === "followup_features") {
    const first = firstFeatureFromAnswer(answerFor(interview, "features"));
    if (first.length > 2) {
      return `You mentioned "${first}" — walk me through what happens when someone uses it. What do they do first, then next?`;
    }
    return DYNAMIC_STEP_DEFS.followup_features.prompt;
  }

  if (stepId === "followup_idea") {
    const idea = answerFor(interview, "idea").trim();
    if (idea.length > 8) {
      const bit =
        idea.length > 42 ? `${idea.slice(0, 42).replace(/\s+\S*$/, "")}…` : idea;
      return `For "${bit}" — someone opens the app for the first time. What's the first thing they do?`;
    }
    return DYNAMIC_STEP_DEFS.followup_idea.prompt;
  }

  return DYNAMIC_STEP_DEFS[stepId].prompt;
}

export function resolveDynamicStep(
  stepId: DynamicStepId,
  interview: InterviewTurn[]
): DynamicInterviewStep {
  return {
    ...DYNAMIC_STEP_DEFS[stepId],
    prompt: personalizeDynamicPrompt(stepId, interview),
  };
}

export function isDynamicStepId(id: string): id is DynamicStepId {
  return (DYNAMIC_STEP_IDS as readonly string[]).includes(id);
}

/** Which spine question triggered this follow-up. */
export const DYNAMIC_ANCHOR: Record<DynamicStepId, "idea" | "features"> = {
  followup_idea: "idea",
  followup_features: "features",
  followup_recipe_depth: "features",
};

const MAX_DYNAMIC_PER_INTERVIEW = 2;

function dynamicCount(interview: InterviewTurn[]): number {
  return interview.filter((t) => isDynamicStepId(t.questionId)).length;
}

function alreadyAsked(interview: InterviewTurn[], id: DynamicStepId): boolean {
  return interview.some((t) => t.questionId === id);
}

function isVague(text: string, minWords = 4): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length < minWords;
}

function cookingContext(blob: string): boolean {
  return /recipe|food|cook|meal|kitchen|dish|ingredient|grocery/.test(blob);
}

function lacksRecipeDepth(blob: string): boolean {
  return (
    cookingContext(blob) &&
    !/detailed|step|ingredient|instruction|full|complete|list/.test(blob)
  );
}

/** Long walkthrough — skip redundant flow follow-ups. */
export function hasDetailedFlow(answer: string): boolean {
  const a = answer.toLowerCase();
  const words = a.split(/\s+/).filter(Boolean).length;
  if (words < 12) return false;
  const flow =
    /apply|match|vice versa|then|first|next|or you can|people who|people that|wanna|want to/.test(
      a
    );
  const setup = /put|enter|post|set|choose|pick|pay|area|breed|location|budget/.test(a);
  return flow && (setup || words >= 18);
}

function lacksConcreteFlow(blob: string): boolean {
  if (hasDetailedFlow(blob)) return false;
  return !/→|->|then|step|when|tap|open|snap|scan|upload|save|share|list|apply|match|vice versa|put|post|pay|breed|area|people who|people that/.test(
    blob
  );
}

/**
 * After a spine answer, optionally return ONE dynamic follow-up.
 * Rules-first — fast, free, predictable.
 */
export function suggestDynamicFollowUp(
  interview: InterviewTurn[],
  spineStepId: string,
  answer: string
): DynamicInterviewStep | null {
  if (dynamicCount(interview) >= MAX_DYNAMIC_PER_INTERVIEW) return null;

  const blob = [
    answerFor(interview, "idea"),
    answerFor(interview, "audience"),
    answer,
  ]
    .join(" ")
    .toLowerCase();

  if (spineStepId === "idea") {
    if (!alreadyAsked(interview, "followup_idea") && isVague(answer, 5)) {
      return resolveDynamicStep("followup_idea", interview);
    }
  }

  if (spineStepId === "features") {
    if (
      !alreadyAsked(interview, "followup_recipe_depth") &&
      lacksRecipeDepth(blob)
    ) {
      return resolveDynamicStep("followup_recipe_depth", interview);
    }
    if (
      !alreadyAsked(interview, "followup_features") &&
      !hasDetailedFlow(answer) &&
      (isVague(answer, 8) || lacksConcreteFlow(answer.toLowerCase()))
    ) {
      return resolveDynamicStep("followup_features", interview);
    }
  }

  return null;
}

/** Merge dynamic answers into build context (features / description). */
export function dynamicInterviewContext(interview: InterviewTurn[]): {
  featureNotes: string[];
  descriptionNotes: string[];
} {
  const featureNotes: string[] = [];
  const descriptionNotes: string[] = [];

  const recipeDepth = answerFor(interview, "followup_recipe_depth");
  if (recipeDepth) {
    featureNotes.push(`Recipe depth preference: ${recipeDepth}`);
    if (/full|step|ingredient|detail/i.test(recipeDepth)) {
      featureNotes.push("Detailed step-by-step recipes with ingredients");
    }
  }

  const featureFlow = answerFor(interview, "followup_features");
  if (featureFlow) featureNotes.push(`Core user flow: ${featureFlow}`);

  const ideaFlow = answerFor(interview, "followup_idea");
  if (ideaFlow) descriptionNotes.push(`First-use example: ${ideaFlow}`);

  return { featureNotes, descriptionNotes };
}
