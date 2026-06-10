import type {
  BrainstormBuildSuggestion,
  BrainstormTurn,
  BuildHandoffIntent,
  BuildPatchOp,
} from "@/lib/types";
import type { ExpoAppModel } from "./types";
import { enrichBuildUserMessage } from "./buildChatContext";
import { isPreviewModelTweakRequest, isPreviewUiTopic } from "./brainstormGuidance";
import {
  expandBuildMessageFromContext,
  extractCopyChangesFromCoach,
  inferBuildTaskFromContext,
  isVagueBuildFollowUp,
  shouldApplyBrainstormPatches,
} from "./resolveBuildIntent";
import { BUILD_DONE_REPLY } from "./buildReply";
import { getStringAtPath, setStringAtPath } from "./tweakPaths";
import { compileTapCopyHandoff, tapEditUserForCoach } from "./tapCopyHandoff";

export type CompiledBuildHandoff = {
  displayPrompt: string;
  applyPrompt: string;
  patches: BuildPatchOp[];
  intent: BuildHandoffIntent;
};

function lastTurn(history: BrainstormTurn[], role: "user" | "assistant"): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.role === role) return history[i]!.content;
  }
  return "";
}

function dedupePatches(patches: BuildPatchOp[]): BuildPatchOp[] {
  const byPath = new Map<string, BuildPatchOp>();
  for (const p of patches) byPath.set(p.path, p);
  return [...byPath.values()];
}

function patchesFromCoachText(coach: string, model: ExpoAppModel): BuildPatchOp[] {
  return dedupePatches(
    extractCopyChangesFromCoach(coach, model).map((c) => ({
      path: c.path,
      value: c.value,
      label: c.desc,
    }))
  );
}

export function formatBuildPatchDisplay(patches: BuildPatchOp[]): string {
  if (!patches.length) return "";
  const lines = patches.map(
    (p) => `• ${humanPatchLabel(p)}\n• Path: ${p.path}\n• Change: → "${p.value}"`
  );
  return `Applying from brainstorm:\n${lines.join("\n")}`;
}

function humanPatchLabel(p: BuildPatchOp): string {
  if (p.path.includes("signInSubtitle")) return "Sign-in subtitle";
  if (p.path.includes("signUpSubtitle")) return "Sign-up subtitle";
  if (p.path.includes("welcomeSubtitle")) return "Welcome subtitle";
  if (p.path.includes("welcomeTitle")) return "Welcome title";
  if (p.path.includes("setupSubtitle")) return "Setup subtitle";
  if (p.path.includes("roles") && p.path.endsWith(".description")) {
    return /walker/i.test(p.label) ? "Dog walker description" : "Dog owner description";
  }
  if (p.path.includes("roles") && p.path.endsWith(".label")) return "Role title";
  if (p.path.startsWith("home.headline")) return "Home headline";
  if (p.path.startsWith("home.subheadline")) return "Home subheadline";
  return p.label || p.path;
}

export function formatPatchesAsApplyPrompt(patches: BuildPatchOp[]): string {
  const parts = patches.map((p) => {
    if (p.path.includes("signInSubtitle")) {
      return `set sign-in subtitle to "${p.value}"`;
    }
    if (p.path.includes("signUpSubtitle")) {
      return `set sign-up subtitle to "${p.value}"`;
    }
    if (p.path.includes("roles") && p.path.endsWith(".description")) {
      const kind = /walker/i.test(p.label) ? "dog walker" : "dog owner";
      return `set ${kind} role description to "${p.value}"`;
    }
    return `set ${p.label} to "${p.value}"`;
  });
  return `Update preview copy: ${parts.join("; ")}.`;
}

function backendHandoff(task: Exclude<BuildHandoffIntent, "copy" | "generic">): CompiledBuildHandoff {
  if (task === "messaging") {
    return {
      displayPrompt: "Wire messaging — Messages tab + Supabase tables",
      applyPrompt:
        "Create conversations and messages tables in Supabase (sender_id and text) " +
        "and wire the Messages tab in the preview with a message list.",
      patches: [],
      intent: "messaging",
    };
  }
  if (task === "auth") {
    return {
      displayPrompt: "Wire sign-up and sign-in in the preview",
      applyPrompt:
        "Wire sign-up and sign-in in the preview with Supabase (Google, Apple, and email).",
      patches: [],
      intent: "auth",
    };
  }
  return {
    displayPrompt: "Add Sign out and Delete account to Profile",
    applyPrompt: "Add Sign out and Delete account to Profile settings.",
    patches: [],
    intent: "sign_out",
  };
}

/**
 * Compile brainstorm + typed Build input into a display line, apply prompt, and structured patches.
 */
export function compileBuildHandoff(input: {
  history: BrainstormTurn[];
  model: ExpoAppModel;
  appName?: string;
  userMessage?: string;
  pendingBuild?: BrainstormBuildSuggestion | null;
  coachText?: string;
  brainstormContext?: string;
  buildHistory?: BrainstormTurn[];
}): CompiledBuildHandoff {
  const rawUserMessage = input.userMessage?.trim() ?? "";
  const buildHistory = input.buildHistory ?? [];
  const userMessage = enrichBuildUserMessage(rawUserMessage, buildHistory);
  const pending = input.pendingBuild;
  const primaryCoach = input.coachText ?? lastTurn(input.history, "assistant");
  const isHandoffDisplay = /^Applying from brainstorm:/i.test(userMessage);
  const fromBrainstorm = shouldApplyBrainstormPatches(userMessage, pending?.patches);
  const appName = input.appName ?? input.model.profile?.displayName ?? "App";
  const lastUserTurn = lastTurn(input.history, "user");

  if (
    isVagueBuildFollowUp(userMessage) &&
    pending?.prompt?.trim() &&
    (!pending.patches?.length || pending.intent === "generic")
  ) {
    const prompt = pending.prompt.trim();
    return {
      displayPrompt: prompt,
      applyPrompt: prompt,
      patches: [],
      intent: pending.intent ?? "generic",
    };
  }

  const previewListingPrompt = [pending?.prompt?.trim(), userMessage].find(
    (p) => p && isPreviewModelTweakRequest(p)
  );

  if (previewListingPrompt) {
    const prompt = previewListingPrompt.trim();
    return {
      displayPrompt: prompt,
      applyPrompt: prompt,
      patches: [],
      intent: "generic",
    };
  }

  if (pending?.patches?.length && pending.intent !== "generic") {
    const display = /^Applying from brainstorm:/i.test(pending.prompt.trim())
      ? pending.prompt.trim()
      : formatBuildPatchDisplay(pending.patches);
    return {
      displayPrompt: display,
      applyPrompt: formatPatchesAsApplyPrompt(pending.patches),
      patches: pending.patches,
      intent: pending.intent ?? "copy",
    };
  }

  const tapUser = tapEditUserForCoach(input.history, userMessage);
  if (primaryCoach && tapUser) {
    const tapHandoff = compileTapCopyHandoff(tapUser, primaryCoach, input.model, appName);
    if (tapHandoff?.patches.length) {
      return tapHandoff;
    }
  }

  let patches: BuildPatchOp[] = [];
  const uiPlanningThread =
    isPreviewUiTopic(lastUserTurn, primaryCoach) ||
    isPreviewModelTweakRequest(userMessage) ||
    Boolean(pending?.prompt?.trim() && isPreviewModelTweakRequest(pending.prompt));
  if (fromBrainstorm && primaryCoach && !uiPlanningThread) {
    patches = patchesFromCoachText(primaryCoach, input.model);
  }
  if (!patches.length && fromBrainstorm && pending?.patches?.length) {
    patches = pending.patches;
  }
  if (
    !patches.length &&
    userMessage &&
    !isVagueBuildFollowUp(userMessage) &&
    !isHandoffDisplay &&
    !isPreviewModelTweakRequest(userMessage)
  ) {
    patches = patchesFromCoachText(userMessage, input.model);
  }
  patches = dedupePatches(patches);

  const backendTask = inferBuildTaskFromContext(input.history, input.brainstormContext);
  const copyIntent =
    patches.length > 0 ||
    /copy|wording|subtitle|headline|onboarding|role picker|description|post a walk|walker side/i.test(
      `${userMessage} ${primaryCoach}`
    );

  if (patches.length > 0) {
    const display =
      userMessage &&
      !isVagueBuildFollowUp(userMessage) &&
      !isHandoffDisplay &&
      patchesFromCoachText(userMessage, input.model).length > 0
        ? userMessage
        : formatBuildPatchDisplay(patches);
    return {
      displayPrompt: display,
      applyPrompt: formatPatchesAsApplyPrompt(patches),
      patches,
      intent: "copy",
    };
  }

  if (backendTask && !copyIntent) {
    return backendHandoff(backendTask);
  }

  if (pending?.prompt?.trim()) {
    const retryTap = tapEditUserForCoach(input.history, userMessage);
    if (retryTap && primaryCoach) {
      const tapHandoff = compileTapCopyHandoff(retryTap, primaryCoach, input.model, appName);
      if (tapHandoff?.patches.length) {
        return tapHandoff;
      }
    }
    const expanded = expandBuildMessageFromContext(
      pending.prompt,
      input.history,
      input.brainstormContext,
      pending.prompt,
      buildHistory
    );
    return {
      displayPrompt: pending.prompt.trim(),
      applyPrompt: expanded,
      patches: [],
      intent: backendTask ?? "generic",
    };
  }

  if (userMessage && !isVagueBuildFollowUp(userMessage)) {
    return {
      displayPrompt: userMessage,
      applyPrompt: expandBuildMessageFromContext(
        userMessage,
        input.history,
        input.brainstormContext
      ),
      patches: [],
      intent: backendTask ?? "generic",
    };
  }

  const expanded = expandBuildMessageFromContext(
    userMessage || "build",
    input.history,
    input.brainstormContext,
    pending?.prompt,
    buildHistory
  );

  if (backendTask) {
    return backendHandoff(backendTask);
  }

  return {
    displayPrompt: userMessage || "Apply what we discussed in brainstorm",
    applyPrompt: expanded,
    patches: [],
    intent: "generic",
  };
}

function ensureAuthOnModel(model: ExpoAppModel): ExpoAppModel {
  if (!model.flow) return model;
  if (model.flow.auth) return model;
  const next = structuredClone(model);
  next.flow = {
    ...next.flow,
    auth: {
      enabled: true,
      signUpTitle: `Join ${model.profile?.displayName ?? "the app"}`,
      signUpSubtitle: model.flow.setupSubtitle,
      submitLabel: "Create account",
      signInTitle: `Welcome back to ${model.profile?.displayName ?? "the app"}`,
      signInSubtitle: "Sign in with Google, Apple, or email.",
      signInSubmitLabel: "Sign in with email",
      captureName: true,
      captureRoleInSignUp: Boolean(model.flow.roles?.length),
    },
  };
  return next;
}

/** Apply structured patches — no LLM. */
export function applyBuildPatches(
  model: ExpoAppModel,
  patches: BuildPatchOp[]
): { model: ExpoAppModel; reply: string } | null {
  if (!patches.length) return null;

  let next = model;
  const applied: string[] = [];

  for (const patch of patches) {
    const before = getStringAtPath(next, patch.path);
    if (before === patch.value) continue;
    const base = patch.path.startsWith("flow.auth.") ? ensureAuthOnModel(next) : next;
    const updated = setStringAtPath(base, patch.path, patch.value);
    if (getStringAtPath(updated, patch.path) === patch.value) {
      next = updated;
      applied.push(humanPatchLabel(patch));
    }
  }

  if (!applied.length) return null;

  return {
    model: next,
    reply: BUILD_DONE_REPLY,
  };
}
