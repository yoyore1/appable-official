import { answerFor } from "@/lib/interviewHelpers";
import type { InterviewTurn } from "@/lib/types";
import {
  clarifyAnchorForStepId,
  clarifyPromptForAnchor,
  isConfusingIdea,
  isGenericAudienceAnswer,
  isNicheIdea,
  isVagueIdea,
} from "@/lib/interviewUnderstanding";

export type DynamicStepId =
  | "followup_idea"
  | "followup_features"
  | "followup_recipe_depth"
  | "followup_clarify_idea"
  | "followup_clarify_audience"
  | "followup_clarify_features";

export interface DynamicInterviewStep {
  id: DynamicStepId;
  prompt: string;
  kind: "text";
}

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
      "Anything we should lock in — how detailed it gets, what info users must enter, or special rules?",
  },
  followup_clarify_idea: {
    id: "followup_clarify_idea",
    kind: "text",
    prompt: "What should I know to build this right?",
  },
  followup_clarify_audience: {
    id: "followup_clarify_audience",
    kind: "text",
    prompt: "Who's the main person this is built for?",
  },
  followup_clarify_features: {
    id: "followup_clarify_features",
    kind: "text",
    prompt: "What's the core loop — step by step?",
  },
};

function firstFeatureFromAnswer(features: string): string {
  return features.split(/[,;]|\band\b/i)[0]?.trim() ?? "";
}

function isClarifyStep(id: DynamicStepId): boolean {
  return id.startsWith("followup_clarify_");
}

/** Friend-texting prompt — references what they already said when we can. */
export function personalizeDynamicPrompt(
  stepId: DynamicStepId,
  interview: InterviewTurn[]
): string {
  const clarifyAnchor = clarifyAnchorForStepId(stepId);
  if (clarifyAnchor) {
    return clarifyPromptForAnchor(clarifyAnchor, interview);
  }

  if (stepId === "followup_recipe_depth") {
    return DYNAMIC_STEP_DEFS.followup_recipe_depth.prompt;
  }

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
      return `For your app idea — someone opens it for the first time. What's the first thing they do?`;
    }
    return DYNAMIC_STEP_DEFS.followup_idea.prompt;
  }

  return DYNAMIC_STEP_DEFS.followup_features.prompt;
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

export function resolveClarifyStep(
  anchor: "idea" | "audience" | "features",
  interview: InterviewTurn[]
): DynamicInterviewStep {
  const id =
    anchor === "idea"
      ? "followup_clarify_idea"
      : anchor === "audience"
        ? "followup_clarify_audience"
        : "followup_clarify_features";
  return resolveDynamicStep(id, interview);
}

export function isDynamicStepId(id: string): id is DynamicStepId {
  return id.startsWith("followup_");
}

/** Which spine question triggered this follow-up. */
export const DYNAMIC_ANCHOR: Record<
  DynamicStepId,
  "idea" | "audience" | "features"
> = {
  followup_idea: "idea",
  followup_clarify_idea: "idea",
  followup_clarify_audience: "audience",
  followup_features: "features",
  followup_recipe_depth: "features",
  followup_clarify_features: "features",
};

const MAX_DYNAMIC_PER_INTERVIEW = 3;

function dynamicCount(interview: InterviewTurn[]): number {
  return interview.filter((t) => isDynamicStepId(t.questionId)).length;
}

function alreadyAsked(interview: InterviewTurn[], id: DynamicStepId): boolean {
  return interview.some((t) => t.questionId === id);
}

function alreadyAskedClarify(
  interview: InterviewTurn[],
  anchor: "idea" | "audience" | "features"
): boolean {
  const id =
    anchor === "idea"
      ? "followup_clarify_idea"
      : anchor === "audience"
        ? "followup_clarify_audience"
        : "followup_clarify_features";
  return alreadyAsked(interview, id);
}

function isVague(text: string, minWords = 4): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length < minWords;
}

function lacksContentDepth(blob: string): boolean {
  return !/detailed|step|full|complete|in-depth|rule|require|must|photo|alarm|verify|enter|field|snooze|sun|outside/.test(
    blob
  );
}

/** Long walkthrough — skip redundant flow follow-ups. */
export function hasDetailedFlow(answer: string): boolean {
  const a = answer.toLowerCase();
  const words = a.split(/\s+/).filter(Boolean).length;
  if (words < 12) return false;
  const flow =
    /apply|match|vice versa|then|first|next|or you can|people who|people that|wanna|want to|instead of|have to|must|photo|snap|camera/.test(
      a
    );
  const setup = /put|enter|post|set|choose|pick|pay|area|breed|location|budget|alarm|snooze/.test(a);
  return flow && (setup || words >= 18);
}

function lacksConcreteFlow(blob: string): boolean {
  if (hasDetailedFlow(blob)) return false;
  return !/→|->|then|step|when|tap|open|snap|scan|upload|save|share|list|apply|match|vice versa|put|post|pay|breed|area|people who|people that|photo|alarm|sun|outside/.test(
    blob
  );
}

/**
 * After a spine answer, optionally return ONE dynamic follow-up.
 * Prefer a targeted clarify question over letting the next step use generic pills.
 */
export function suggestDynamicFollowUp(
  interview: InterviewTurn[],
  spineStepId: string,
  answer: string
): DynamicInterviewStep | null {
  if (dynamicCount(interview) >= MAX_DYNAMIC_PER_INTERVIEW) return null;

  const idea = answerFor(interview, "idea");
  const blob = [idea, answerFor(interview, "audience"), answer]
    .join(" ")
    .toLowerCase();

  if (spineStepId === "idea") {
    if (!alreadyAsked(interview, "followup_idea") && !alreadyAskedClarify(interview, "idea")) {
      if (isConfusingIdea(answer)) {
        return resolveClarifyStep("idea", interview);
      }
      if (isVagueIdea(answer, 5)) {
        return resolveDynamicStep("followup_idea", interview);
      }
    }
  }

  if (spineStepId === "audience") {
    if (
      !alreadyAskedClarify(interview, "audience") &&
      isNicheIdea(idea) &&
      (isGenericAudienceAnswer(answer) || isVague(answer, 4))
    ) {
      return resolveClarifyStep("audience", interview);
    }
  }

  if (spineStepId === "features") {
    if (
      !alreadyAskedClarify(interview, "features") &&
      isNicheIdea(idea) &&
      isVague(answer, 6) &&
      !hasDetailedFlow(answer)
    ) {
      return resolveClarifyStep("features", interview);
    }
    if (
      !alreadyAsked(interview, "followup_recipe_depth") &&
      lacksContentDepth(blob)
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

  const depthAnswer = answerFor(interview, "followup_recipe_depth");
  if (depthAnswer) {
    featureNotes.push(`Key detail / rules: ${depthAnswer}`);
  }

  const featureFlow = answerFor(interview, "followup_features");
  if (featureFlow) featureNotes.push(`Core user flow: ${featureFlow}`);

  const ideaFlow = answerFor(interview, "followup_idea");
  if (ideaFlow) descriptionNotes.push(`First-use example: ${ideaFlow}`);

  const poolRules = answerFor(interview, "pool_rules");
  if (poolRules) featureNotes.push(`Hard rules: ${poolRules}`);
  const poolProof = answerFor(interview, "pool_proof");
  if (poolProof) featureNotes.push(`Verification: ${poolProof}`);
  const poolCore = answerFor(interview, "pool_core_loop");
  if (poolCore) featureNotes.push(`Core features: ${poolCore}`);
  const poolWho = answerFor(interview, "pool_who");
  if (poolWho) descriptionNotes.push(`Audience: ${poolWho}`);
  const poolFirst = answerFor(interview, "pool_first_use");
  if (poolFirst) descriptionNotes.push(`First use: ${poolFirst}`);

  for (const id of [
    "followup_clarify_idea",
    "followup_clarify_audience",
    "followup_clarify_features",
  ] as const) {
    const a = answerFor(interview, id);
    if (a) descriptionNotes.push(`Clarification: ${a}`);
  }

  return { featureNotes, descriptionNotes };
}
