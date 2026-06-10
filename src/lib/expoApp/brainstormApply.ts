import type { BrainstormBuildSuggestion, BrainstormTurn } from "@/lib/types";
import { resolveBuildHandoff } from "./buildHandoff";
import {
  isBrainstormReadyToApply,
} from "./brainstormNormie";
import type { ExpoAppModel } from "./types";
import {
  BUILD_COMMAND_RE,
  isVagueBuildFollowUp,
} from "./resolveBuildIntent";

export type BrainstormApplyHandoff = NonNullable<
  ReturnType<typeof resolveBuildHandoff>
>;

/** User confirmed in Brainstorm — "yes", "do it", "apply", etc. */
export function isBrainstormApplyConfirmation(message: string): boolean {
  const t = message.trim();
  if (!t || t.length > 96) return false;
  return isVagueBuildFollowUp(t) || BUILD_COMMAND_RE.test(t);
}

/** @deprecated use isBrainstormReadyToApply */
export function hasActionableBrainstormHandoff(
  handoff: BrainstormApplyHandoff | null,
  pendingBuild: BrainstormBuildSuggestion | null,
  history: BrainstormTurn[]
): boolean {
  return isBrainstormReadyToApply(handoff, pendingBuild, history);
}

/** Auto-apply when founder says "yes / do it" and a real work order exists. */
export function shouldAutoApplyFromBrainstorm(
  message: string,
  handoff: BrainstormApplyHandoff | null,
  pendingBuild: BrainstormBuildSuggestion | null,
  history: BrainstormTurn[]
): boolean {
  if (!isBrainstormApplyConfirmation(message)) return false;
  return isBrainstormReadyToApply(handoff, pendingBuild, history);
}

export function resolveBrainstormApplyHandoff(input: {
  history: BrainstormTurn[];
  pendingBuild?: BrainstormBuildSuggestion | null;
  model?: ExpoAppModel | null;
  appName?: string;
}): BrainstormApplyHandoff | null {
  const handoff = resolveBuildHandoff(input);
  if (!handoff) return null;
  if (!isBrainstormReadyToApply(handoff, input.pendingBuild ?? null, input.history)) {
    return null;
  }
  return handoff;
}
