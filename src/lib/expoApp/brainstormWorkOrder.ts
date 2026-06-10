import type { BrainstormBuildSuggestion, BrainstormTurn } from "@/lib/types";
import { isPreviewUiTopic } from "./brainstormGuidance";
import { compileBuildHandoff } from "./compileBuildHandoff";
import { parseCoachReplacement, tapEditUserForCoach } from "./tapCopyHandoff";
import type { ExpoAppModel } from "./types";

const COACH_READY_RE =
  /want to update|sign-?in subtitle|switch to build|tap build|tap \*\*build\*\*|apply to app|tap \*\*apply to app\*\*|hit build|replace it with|next step:|update the (copy|preview)/i;

/** Coach proposed a concrete preview copy change — Build should run. */
export function isCoachBuildReady(coachText: string): boolean {
  return COACH_READY_RE.test(coachText);
}

/**
 * Cursor-style work order at end of brainstorm: structured ticket + patches.
 * Never returns a vague paraphrase when we can compile a path-level patch.
 */
export function finalizeBrainstormWorkOrder(input: {
  history: BrainstormTurn[];
  model: ExpoAppModel;
  appName: string;
  coachText: string;
  userMessage: string;
}): BrainstormBuildSuggestion | null {
  if (
    isPreviewUiTopic(input.userMessage, input.coachText) &&
    !/replace it with:\s*["']/i.test(input.coachText)
  ) {
    return null;
  }

  const thread: BrainstormTurn[] = [
    ...input.history,
    { role: "user", content: input.userMessage },
    { role: "assistant", content: input.coachText },
  ];

  const compiled = compileBuildHandoff({
    history: thread,
    model: input.model,
    appName: input.appName,
    coachText: input.coachText,
    userMessage: input.userMessage,
  });

  const coachReady = isCoachBuildReady(input.coachText);
  const hasReplacement = Boolean(parseCoachReplacement(input.coachText));
  const tapThread = Boolean(tapEditUserForCoach(thread, input.userMessage));

  if (compiled.patches.length > 0) {
    return {
      label: "Apply to app",
      prompt: compiled.displayPrompt,
      patches: compiled.patches,
      intent: compiled.intent,
    };
  }

  if (coachReady && (hasReplacement || tapThread) && compiled.displayPrompt.trim()) {
    return {
      label: "Apply to app",
      prompt: compiled.displayPrompt,
      patches: compiled.patches,
      intent: compiled.intent,
    };
  }

  if (!coachReady) return null;

  return null;
}
