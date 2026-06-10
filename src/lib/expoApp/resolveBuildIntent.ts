import type { BrainstormTurn } from "@/lib/types";
import { isPreviewUiTopic } from "./brainstormGuidance";
import { enrichBuildUserMessage } from "./buildChatContext";
import { wantsAuthPreviewWork, wantsMessagingBackendWork } from "./applyMessagingPreview";
import type { ExpoAppModel } from "./types";
import { getStringAtPath, setStringAtPath } from "./tweakPaths";

/** Backend wiring handoff — not preview copy tweaks. */
export function isBackendBuildRequest(message: string): boolean {
  return wantsAuthPreviewWork(message) || wantsMessagingBackendWork(message);
}

const SHORT_FOLLOWUP_RE =
  /^(yes|yeah|yep|yup|sure|ok|okay|do it|go ahead|proceed|please|let'?s do it|let'?s go|sounds good)([,.]?\s*(do it|please|go ahead))?\.?!?$/i;

/** User switched to Build / Brainstorm and wants the last plan applied. */
export const BUILD_COMMAND_RE =
  /^(build|apply|apply it|update|update it|make the change|do the update|go)\.?!?$/i;

const READY_TO_BUILD_RE =
  /\b(ready|rdy)\b.*\bbuild\b|\bbuild it\b|\bso we\b.*\bbuild\b|\bwant to proceed\b|\bcreate the tables\b|\blet'?s create\b.*\btable/i;

const BUILD_VERB_RE =
  /\b(build|wire|implement|create|add|set up|hook up|make)\b/i;

/** Explicit backend wiring — not “Chat tab” or “in-app chat” as a product feature. */
const MESSAGING_BACKEND_RE =
  /\b(wire\s+messaging|messaging\s+tables?|messages?\s+table|create\s+(the\s+)?tables|sender_id|appable_messages|appable_conversations|conversations?\s+and\s+messages?\s+tables?)\b/i;

const COPY_DISCUSSION_RE =
  /\b(onboarding|role picker|sign-?in|sign-?up|subtitle|swap|wording|subtext|description|headline|shorter|friendlier|clearer|cta|copy|dog owner|dog walker|post a walk|get matched|earn walking|value prop|misleading|community|best friend)\b/i;

const GENERIC_COPY_HANDOFF_RE =
  /update the role picker|exactly as described|what we (just )?(planned|discussed)|last brainstorm/i;

type CopyChange = { path: string; value: string; desc: string };

function roleDescriptionPath(
  model: ExpoAppModel,
  kind: "owner" | "walker"
): string | null {
  const roles = model.flow?.roles ?? [];
  const idx = roles.findIndex((r) => {
    const blob = `${r.id} ${r.label}`.toLowerCase();
    return kind === "owner" ? /owner/.test(blob) : /walker/.test(blob);
  });
  if (idx < 0) return null;
  return `flow.roles[${idx}].description`;
}

function findFlowPathsContaining(model: ExpoAppModel, needle: string): string[] {
  const n = needle.trim().toLowerCase();
  if (!n) return [];
  const paths: string[] = [];
  if (model.flow?.welcomeSubtitle?.toLowerCase().includes(n)) {
    paths.push("flow.welcomeSubtitle");
  }
  if (model.flow?.welcomeTitle?.toLowerCase().includes(n)) {
    paths.push("flow.welcomeTitle");
  }
  if (model.flow?.setupSubtitle?.toLowerCase().includes(n)) {
    paths.push("flow.setupSubtitle");
  }
  if (model.flow?.auth?.signInSubtitle?.toLowerCase().includes(n)) {
    paths.push("flow.auth.signInSubtitle");
  }
  if (model.flow?.auth?.signUpSubtitle?.toLowerCase().includes(n)) {
    paths.push("flow.auth.signUpSubtitle");
  }
  for (let i = 0; i < (model.flow?.roles?.length ?? 0); i++) {
    const role = model.flow!.roles![i]!;
    if (role.description?.toLowerCase().includes(n)) {
      paths.push(`flow.roles[${i}].description`);
    }
    if (role.label?.toLowerCase().includes(n)) {
      paths.push(`flow.roles[${i}].label`);
    }
  }
  return paths;
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

function applyCopyChange(model: ExpoAppModel, change: CopyChange): ExpoAppModel {
  let next = change.path.startsWith("flow.auth.") ? ensureAuthOnModel(model) : model;
  const applied = setStringAtPath(next, change.path, change.value);
  return getStringAtPath(applied, change.path) === change.value ? applied : model;
}

/** Parse coach / brainstorm text into concrete preview paths + values. */
export function extractCopyChangesFromCoach(
  coach: string,
  model: ExpoAppModel
): CopyChange[] {
  const changes: CopyChange[] = [];
  const seen = new Set<string>();

  function add(path: string | null, value: string, desc: string) {
    const v = value.trim();
    if (!path || !v) return;
    const key = `${path}:${v.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    changes.push({ path, value: v, desc });
  }

  function addRole(kind: "owner" | "walker", value: string) {
    const path = roleDescriptionPath(model, kind);
    add(path, value, kind === "owner" ? "dog owner description" : "dog walker description");
  }

  let m: RegExpExecArray | null;

  const misleading = coach.match(/["']([^"']+)["']\s+is misleading/i)?.[1];
  const useDirect = coach.match(/\buse\s+["']([^"']+)["']/i)?.[1];
  if (misleading && useDirect) {
    for (const path of findFlowPathsContaining(model, misleading)) {
      add(path, useDirect, "updated misleading copy");
    }
  }

  const swapRe = /swap\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/gi;
  while ((m = swapRe.exec(coach))) {
    for (const path of findFlowPathsContaining(model, m[1]!)) {
      add(path, m[2]!, "swapped copy");
    }
  }

  const arrowRe = /["']([^"']+)["']\s*(?:→|->)\s*["']([^"']+)["']/gi;
  while ((m = arrowRe.exec(coach))) {
    for (const path of findFlowPathsContaining(model, m[1]!)) {
      add(path, m[2]!, "updated copy");
    }
  }

  const signInPatterns = [
    /(?:update|change|set)\s+(?:the\s+)?sign-?in\s+subtitle\s+to\s+["']([^"']+)["']/gi,
    /sign-?in\s+subtitle\s+to\s+["']([^"']+)["']/gi,
    /want to update\s+(?:the\s+)?sign-?in\s+subtitle\s+to\s+["']([^"']+)["']/gi,
  ];
  for (const re of signInPatterns) {
    while ((m = re.exec(coach))) {
      add("flow.auth.signInSubtitle", m[1]!, "sign-in subtitle");
    }
  }

  const signUpPatterns = [
    /(?:update|change|set)\s+(?:the\s+)?sign-?up\s+subtitle\s+to\s+["']([^"']+)["']/gi,
    /sign-?up\s+subtitle\s+to\s+["']([^"']+)["']/gi,
  ];
  for (const re of signUpPatterns) {
    while ((m = re.exec(coach))) {
      add("flow.auth.signUpSubtitle", m[1]!, "sign-up subtitle");
    }
  }

  const neutralBridge = coach.match(
    /neutral(?:\s+but\s+accurate)?\s+bridge\s*:?\s*["']([^"']+)["']/i
  );
  if (neutralBridge && /sign-?in|community|subtitle/i.test(coach)) {
    add("flow.auth.signInSubtitle", neutralBridge[1]!, "sign-in subtitle");
    add("flow.auth.signUpSubtitle", neutralBridge[1]!, "sign-up subtitle");
  }

  const walkerSideRe = /for the walker side,?\s+use\s+["']([^"']+)["']/gi;
  while ((m = walkerSideRe.exec(coach))) addRole("walker", m[1]!);

  const ownerSideRe = /for the owner side,?\s+use\s+["']([^"']+)["']/gi;
  while ((m = ownerSideRe.exec(coach))) addRole("owner", m[1]!);

  for (const sentence of coach.split(/(?<=[.!?])\s+|\n+/)) {
    const useM = sentence.match(/\buse\s+["']([^"']+)["']/i);
    if (!useM) continue;
    const lower = sentence.toLowerCase();
    if (/for the walker|walker\s+side/.test(lower)) {
      addRole("walker", useM[1]!);
    } else if (/for the owner|owner\s+side|passive|walk my dog|complaint|not a plea/.test(lower)) {
      addRole("owner", useM[1]!);
    }
  }

  for (const para of coach.split(/\n\n+/)) {
    const passiveQuote = para.match(
      /["']([^"']+)["']\s+is\s+(?:passive|misleading|weak|a complaint)/i
    )?.[1];
    const useInPara = para.match(/\buse\s+["']([^"']+)["']/i)?.[1];
    if (passiveQuote && useInPara) {
      const idx = model.flow?.roles?.findIndex((r) =>
        r.description.toLowerCase().includes(passiveQuote.toLowerCase().slice(0, 24))
      );
      if (idx !== undefined && idx >= 0) {
        add(`flow.roles[${idx}].description`, useInPara, "dog owner description");
      } else {
        addRole("owner", useInPara);
      }
    }
  }

  const bulletRe = /•\s*([^→\n]+?)\s*→\s*["']([^"']+)["']/gi;
  while ((m = bulletRe.exec(coach))) {
    const label = m[1]!.trim().toLowerCase();
    const value = m[2]!.trim();
    if (/sign-?in subtitle/.test(label)) {
      add("flow.auth.signInSubtitle", value, "sign-in subtitle");
    } else if (/sign-?up subtitle/.test(label)) {
      add("flow.auth.signUpSubtitle", value, "sign-up subtitle");
    } else if (/walker/.test(label)) {
      addRole("walker", value);
    } else if (/owner/.test(label)) {
      addRole("owner", value);
    }
  }

  const ownerPatterns = [
    /(?:if they (?:picked|pick|chose|choose)|for)\s+(?:the\s+)?dog\s+owner(?:s)?(?:\s+role)?\s*:?\s*["']([^"']+)["']/gi,
    /\*\s*(?:if they (?:picked|pick))?\s*dog\s+owner(?:s)?\s*:\s*["']([^"']+)["']/gi,
    /\d+\.\s*(?:dog\s+)?owners?\s*:\s*["']([^"']+)["']/gi,
    /for dog owners?:[\s\S]*?(?:cta|onboarding|description)\s*:?\s*["']([^"']+)["']/gi,
  ];
  for (const re of ownerPatterns) {
    while ((m = re.exec(coach))) addRole("owner", m[1]!);
  }

  const walkerPatterns = [
    /(?:if they (?:picked|pick|chose|choose)|for)\s+(?:the\s+)?dog\s+walker(?:s)?(?:\s+role)?\s*:?\s*["']([^"']+)["']/gi,
    /\*\s*(?:if they (?:picked|pick))?\s*dog\s+walker(?:s)?\s*:\s*["']([^"']+)["']/gi,
    /\d+\.\s*(?:dog\s+)?walkers?\s*:\s*["']([^"']+)["']/gi,
    /for dog walkers?:[\s\S]*?(?:cta|onboarding|description)\s*:?\s*["']([^"']+)["']/gi,
  ];
  for (const re of walkerPatterns) {
    while ((m = re.exec(coach))) addRole("walker", m[1]!);
  }

  const setRe = /set\s+([^:]+?)\s+role\s+description\s+to\s+["']([^"']+)["']/gi;
  while ((m = setRe.exec(coach))) {
    const roleName = m[1]!.trim().toLowerCase();
    if (/walker|earn/.test(roleName)) addRole("walker", m[2]!);
    else addRole("owner", m[2]!);
  }

  const changeRe = /change\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/gi;
  while ((m = changeRe.exec(coach))) {
    for (const path of findFlowPathsContaining(model, m[1]!)) {
      add(path, m[2]!, "updated copy");
    }
    const from = m[1]!.trim().toLowerCase();
    if (model.flow?.roles?.some((r) => r.description.toLowerCase().includes(from))) {
      const idx = model.flow.roles.findIndex((r) =>
        r.description.toLowerCase().includes(from)
      );
      if (idx >= 0) {
        add(`flow.roles[${idx}].description`, m[2]!, "role description");
      }
    }
  }

  const setSubtitleRe = /set\s+(sign-?in|sign-?up)\s+subtitle\s+to\s+["']([^"']+)["']/gi;
  while ((m = setSubtitleRe.exec(coach))) {
    const which = m[1]!.toLowerCase();
    const path =
      which.includes("in") && !which.includes("up")
        ? "flow.auth.signInSubtitle"
        : "flow.auth.signUpSubtitle";
    add(path, m[2]!, `${which} subtitle`);
  }

  return changes;
}

export type InferredBuildTask = "messaging" | "auth" | "sign_out" | null;

function historyBlob(history: BrainstormTurn[], maxTurns = 8): string {
  return history
    .slice(-maxTurns)
    .map((t) => t.content)
    .join("\n")
    .toLowerCase();
}

function lastAssistantMessage(history: BrainstormTurn[]): string {
  return [...history].reverse().find((t) => t.role === "assistant")?.content ?? "";
}

/** Only apply brainstorm coach patches — not on free-form Build chat. */
export function shouldApplyBrainstormPatches(
  userMessage: string,
  explicitPatches?: { path: string }[] | null
): boolean {
  const msg = userMessage.trim();
  if (explicitPatches?.length) return true;
  if (/^Applying from brainstorm:/i.test(msg)) return true;
  if (/^Tap Build to apply/i.test(msg) && explicitPatches?.length) return true;
  if (isVagueBuildFollowUp(msg) && explicitPatches?.length) return true;
  if (isVagueBuildFollowUp(msg)) return true;
  return false;
}

/** User confirmed in Build without repeating the topic ("yes", "build", "yes do it"). */
export function isVagueBuildFollowUp(message: string): boolean {
  const t = message.trim();
  if (t.length > 96) return false;
  return (
    SHORT_FOLLOWUP_RE.test(t) ||
    BUILD_COMMAND_RE.test(t) ||
    READY_TO_BUILD_RE.test(t)
  );
}

function expandFromLastBrainstormCopy(history: BrainstormTurn[]): string | null {
  const lastCoach = lastAssistantMessage(history);
  const lastUser =
    [...history].reverse().find((t) => t.role === "user")?.content ?? "";
  if (isPreviewUiTopic(lastUser, lastCoach)) return null;
  return buildCopyUpdateFromCoach(lastCoach);
}

export function inferBuildTaskFromContext(
  history: BrainstormTurn[],
  _context?: string
): InferredBuildTask {
  const blob = historyBlob(history);

  if (MESSAGING_BACKEND_RE.test(blob)) {
    return "messaging";
  }

  if (
    /sign[\s-]?out|delete account|account controls/.test(blob) &&
    /profile|settings/.test(blob)
  ) {
    return "sign_out";
  }

  if (
    /\b(wire\s+(sign[\s-]?up|sign[\s-]?in|auth)|sign[\s-]?up\s+and\s+sign[\s-]?in|supabase\s+auth|enable\s+auth)\b/.test(
      blob
    )
  ) {
    return "auth";
  }

  return null;
}

function stubModelForCopyExtract(model?: ExpoAppModel | null): ExpoAppModel {
  if (model) return model;
  return {
    flow: {
      roles: [
        { id: "owner", label: "Dog owner", description: "" },
        { id: "walker", label: "Dog walker", description: "" },
      ],
    },
    profile: { displayName: "App", tagline: "" },
    home: { headline: "", subheadline: "", heroLabel: "", heroSublabel: "", sections: [] },
    onboarding: [],
    tabs: [],
    tabScreens: {},
    theme: {
      accent: "#000",
      cream: "#fff",
      card: "#fff",
      charcoal: "#000",
      muted: "#666",
      line: "#ccc",
    },
  } as ExpoAppModel;
}

function formatCopyChangesAsBuildPrompt(changes: CopyChange[]): string {
  const parts = changes.map((c) => {
    if (c.path.includes("signInSubtitle")) {
      return `set sign-in subtitle to "${c.value}"`;
    }
    if (c.path.includes("signUpSubtitle")) {
      return `set sign-up subtitle to "${c.value}"`;
    }
    if (c.path.includes("roles") && c.path.endsWith(".description")) {
      const kind = /walker/.test(c.desc) ? "dog walker" : "dog owner";
      return `set ${kind} role description to "${c.value}"`;
    }
    return `set ${c.desc} to "${c.value}"`;
  });
  return `Update preview copy: ${parts.join("; ")}.`;
}

/** Turn the last coach copy suggestions into a concrete Build instruction. */
export function buildCopyUpdateFromCoach(
  lastCoach: string,
  model?: ExpoAppModel | null
): string | null {
  if (!COPY_DISCUSSION_RE.test(lastCoach)) return null;
  if (isPreviewUiTopic("", lastCoach)) return null;

  const changes = extractCopyChangesFromCoach(
    lastCoach,
    stubModelForCopyExtract(model)
  );
  if (changes.length > 0) {
    return formatCopyChangesAsBuildPrompt(changes);
  }

  return null;
}

/** Apply brainstorm coach copy to the live preview (deterministic — no LLM). */
export function tryApplyCopyFromBrainstorm(
  model: ExpoAppModel,
  message: string,
  history: BrainstormTurn[] = []
): { model: ExpoAppModel; reply: string } | null {
  const lastCoach = lastAssistantMessage(history);
  const coachBlob = GENERIC_COPY_HANDOFF_RE.test(message) && lastCoach
    ? `${lastCoach}\n${message}`
    : lastCoach && COPY_DISCUSSION_RE.test(lastCoach) && COPY_DISCUSSION_RE.test(message)
      ? `${lastCoach}\n${message}`
      : message;

  if (!COPY_DISCUSSION_RE.test(coachBlob) && !/update preview copy|role description|sign-in subtitle/i.test(message)) {
    return null;
  }

  const changes = extractCopyChangesFromCoach(coachBlob, model);
  if (changes.length === 0) return null;

  let next = model;
  const applied: string[] = [];
  for (const change of changes) {
    const updated = applyCopyChange(next, change);
    if (getStringAtPath(updated, change.path) === change.value) {
      next = updated;
      applied.push(change.desc);
    }
  }

  if (applied.length === 0) return null;

  const unique = [...new Set(applied)];
  return {
    model: next,
    reply: `Updated preview copy: ${unique.join(", ")}.`,
  };
}

/** Apply role description swaps from an expanded build message (deterministic). */
export function tryApplyRoleCopyFromMessage(
  model: ExpoAppModel,
  message: string,
  history: BrainstormTurn[] = []
): { model: ExpoAppModel; reply: string } | null {
  const fromBrainstorm = tryApplyCopyFromBrainstorm(model, message, history);
  if (fromBrainstorm) return fromBrainstorm;

  if (!model.flow?.roles?.length) return null;
  if (!/role picker|role description|update role picker copy|dog owner|dog walker|update preview copy/i.test(message)) {
    return null;
  }

  const changes = extractCopyChangesFromCoach(message, model);
  if (changes.length === 0) return null;

  let next = model;
  let n = 0;
  for (const change of changes) {
    const updated = applyCopyChange(next, change);
    if (getStringAtPath(updated, change.path) === change.value) {
      next = updated;
      n++;
    }
  }

  if (n === 0) return null;
  return {
    model: next,
    reply: `Updated ${n} piece${n === 1 ? "" : "s"} of preview copy.`,
  };
}

/** Expand short Build messages using recent brainstorm thread. */
export function resolveEffectiveBuildMessage(
  message: string,
  history: BrainstormTurn[] = [],
  context?: string
): string {
  const trimmed = message.trim();

  if (isVagueBuildFollowUp(trimmed)) {
    const copyPrompt = expandFromLastBrainstormCopy(history);
    if (copyPrompt) return copyPrompt;
  }

  if (!isVagueBuildFollowUp(trimmed)) return trimmed;

  const task = inferBuildTaskFromContext(history, context);

  if (task === "messaging") {
    return (
      "Create conversations and messages tables in Supabase (sender_id and text) " +
      "and wire the Messages tab in the preview with a message list."
    );
  }

  if (task === "auth") {
    return "Wire sign-up and sign-in in the preview with Supabase (Google, Apple, and email).";
  }

  if (task === "sign_out") {
    return "Add Sign out and Delete account to Profile settings.";
  }

  const lastCoach = lastAssistantMessage(history);
  if (
    MESSAGING_BACKEND_RE.test(lastCoach) &&
    /proceed|create|build mode|switch to build/i.test(lastCoach)
  ) {
    return (
      "Create conversations and messages tables in Supabase and wire messaging in the preview."
    );
  }

  return trimmed;
}

export function isBuildExecutionMessage(message: string): boolean {
  const t = message.trim();
  if (isVagueBuildFollowUp(t)) return true;
  return BUILD_VERB_RE.test(t);
}

function taskToBuildMessage(task: InferredBuildTask): string | null {
  if (task === "messaging") {
    return (
      "Create conversations and messages tables in Supabase (sender_id and text) " +
      "and wire the Messages tab in the preview with a message list."
    );
  }
  if (task === "auth") {
    return "Wire sign-up and sign-in in the preview with Supabase (Google, Apple, and email).";
  }
  if (task === "sign_out") {
    return "Add Sign out and Delete account to Profile settings.";
  }
  return null;
}

/** Expand vague or short build requests using brainstorm thread + explicit verbs. */
export function expandBuildMessageFromContext(
  message: string,
  history: BrainstormTurn[] = [],
  context?: string,
  pendingPrompt?: string | null,
  buildHistory: BrainstormTurn[] = []
): string {
  const trimmed = message.trim();

  if (
    (BUILD_COMMAND_RE.test(trimmed) || SHORT_FOLLOWUP_RE.test(trimmed)) &&
    pendingPrompt?.trim()
  ) {
    return pendingPrompt.trim();
  }

  if (isVagueBuildFollowUp(trimmed) && buildHistory.length >= 2) {
    const enriched = enrichBuildUserMessage(trimmed, buildHistory);
    if (enriched !== trimmed) return enriched;
  }

  if (BUILD_COMMAND_RE.test(trimmed) || SHORT_FOLLOWUP_RE.test(trimmed)) {
    if (buildHistory.length >= 2) {
      const enriched = enrichBuildUserMessage(trimmed, buildHistory);
      if (enriched !== trimmed) return enriched;
    }
    const copyPrompt = expandFromLastBrainstormCopy(history);
    if (copyPrompt) return copyPrompt;
  }

  const resolved = resolveEffectiveBuildMessage(message, history, context);
  if (resolved !== trimmed) return resolved;

  const m = trimmed.toLowerCase();
  const task = inferBuildTaskFromContext(history, context);
  const expanded = task ? taskToBuildMessage(task) : null;

  if (expanded && task === "messaging" && MESSAGING_BACKEND_RE.test(historyBlob(history))) {
    return expanded;
  }
  if (expanded && task !== "messaging" && (isBuildExecutionMessage(message) || BUILD_VERB_RE.test(m))) {
    return expanded;
  }

  if (BUILD_VERB_RE.test(m) && MESSAGING_BACKEND_RE.test(m)) {
    return taskToBuildMessage("messaging")!;
  }
  if (BUILD_VERB_RE.test(m) && /sign[\s-]?up|sign[\s-]?in|auth|login|register/.test(m)) {
    return taskToBuildMessage("auth")!;
  }

  return resolved;
}
