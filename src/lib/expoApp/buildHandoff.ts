import type { BrainstormBuildSuggestion, BrainstormTurn } from "@/lib/types";
import type { ExpoAppModel } from "./types";
import { compileBuildHandoff } from "./compileBuildHandoff";

function lastBrainstormTurn(
  history: BrainstormTurn[],
  role: "user" | "assistant"
): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.role === role) return history[i]!.content;
  }
  return null;
}

/** Build prompt for the floating Build chip — pending suggestion or compiled thread. */
export function buildPromptForFloatingBuild(
  history: BrainstormTurn[],
  pendingBuild?: BrainstormBuildSuggestion | null,
  model?: ExpoAppModel | null,
  appName?: string
): string {
  if (!model) {
    if (pendingBuild?.prompt?.trim()) return pendingBuild.prompt.trim();
    const lastAssistant = lastBrainstormTurn(history, "assistant")?.trim() ?? "";
    if (lastAssistant) return lastAssistant.slice(0, 500);
    const lastUser = lastBrainstormTurn(history, "user")?.trim();
    if (lastUser && lastUser.length >= 8) return lastUser;
    return "Apply what we discussed in brainstorm.";
  }

  const compiled = compileBuildHandoff({
    history,
    model,
    appName: appName ?? model.profile?.displayName,
    pendingBuild,
  });
  return compiled.displayPrompt;
}

/** Floating Build CTA — always available in brainstorm once there is a thread. */
export function resolveBuildHandoff(input: {
  history: BrainstormTurn[];
  pendingBuild?: BrainstormBuildSuggestion | null;
  model?: ExpoAppModel | null;
  appName?: string;
}): {
  label: string;
  prompt: string;
  displayPrompt: string;
  patches: import("@/lib/types").BuildPatchOp[];
  intent: import("@/lib/types").BuildHandoffIntent;
} | null {
  if (input.history.length < 2) return null;

  if (!input.model) {
    const prompt = buildPromptForFloatingBuild(input.history, input.pendingBuild);
    if (!prompt.trim()) return null;
    return {
      label: input.pendingBuild?.label?.trim() || "Apply to app",
      prompt,
      displayPrompt: prompt,
      patches: input.pendingBuild?.patches ?? [],
      intent: input.pendingBuild?.intent ?? "generic",
    };
  }

  const compiled = compileBuildHandoff({
    history: input.history,
    model: input.model,
    appName: input.appName ?? input.model.profile?.displayName,
    pendingBuild: input.pendingBuild,
  });

  if (!compiled.displayPrompt.trim() && !compiled.patches.length) return null;

  return {
    label: input.pendingBuild?.label?.trim() || "Apply to app",
    prompt: compiled.applyPrompt,
    displayPrompt: compiled.displayPrompt,
    patches: compiled.patches,
    intent: compiled.intent,
  };
}
