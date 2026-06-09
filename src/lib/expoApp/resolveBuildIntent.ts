import type { BrainstormTurn } from "@/lib/types";
import type { ExpoAppModel } from "./types";
import { setStringAtPath } from "./tweakPaths";

const SHORT_FOLLOWUP_RE =
  /^(yes|yeah|yep|yup|sure|ok|okay|do it|go ahead|proceed|please|let'?s do it|let'?s go|sounds good)([,.]?\s*(do it|please|go ahead))?\.?!?$/i;

/** User switched to Build and wants the last brainstorm plan applied. */
const BUILD_COMMAND_RE =
  /^(build|apply|apply it|update|update it|make the change|do the update|go)\.?!?$/i;

const READY_TO_BUILD_RE =
  /\b(ready|rdy)\b.*\bbuild\b|\bbuild it\b|\bso we\b.*\bbuild\b|\bwant to proceed\b|\bcreate the tables\b|\blet'?s create\b.*\btable/i;

const BUILD_VERB_RE =
  /\b(build|wire|implement|create|add|set up|hook up|make)\b/i;

/** Explicit backend wiring — not “Chat tab” or “in-app chat” as a product feature. */
const MESSAGING_BACKEND_RE =
  /\b(wire\s+messaging|messaging\s+tables?|messages?\s+table|create\s+(the\s+)?tables|sender_id|appable_messages|appable_conversations|conversations?\s+and\s+messages?\s+tables?)\b/i;

const COPY_DISCUSSION_RE =
  /\b(onboarding|role picker|swap|wording|subtext|description|headline|shorter|friendlier|clearer|cta|copy|dog owner|dog walker)\b/i;

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
  return buildCopyUpdateFromCoach(lastAssistantMessage(history));
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

/** Turn the last coach copy suggestions into a concrete Build instruction. */
export function buildCopyUpdateFromCoach(lastCoach: string): string | null {
  if (!COPY_DISCUSSION_RE.test(lastCoach)) return null;

  const changes: string[] = [];
  const swapRe = /swap\s+["']([^"']+)["']\s+with\s+["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = swapRe.exec(lastCoach))) {
    changes.push(`change "${m[1]}" to "${m[2]}"`);
  }

  const arrowRe = /["']([^"']+)["']\s*(?:→|->)\s*["']([^"']+)["']/gi;
  while ((m = arrowRe.exec(lastCoach))) {
    changes.push(`change "${m[1]}" to "${m[2]}"`);
  }

  const useRe =
    /for (?:the\s+)?([^.\n]+?)\s+role,?\s+use\s+["']([^"']+)["']/gi;
  while ((m = useRe.exec(lastCoach))) {
    changes.push(`set ${m[1]!.trim()} role description to "${m[2]}"`);
  }

  const suggestRe =
    /(?:try|use|shorter(?:\s+version)?|suggest(?:ion)?)\s*:?\s*["']([^"']+)["']/gi;
  while ((m = suggestRe.exec(lastCoach))) {
    const roleMatch = lastCoach.match(
      /(?:dog owner|owner|walker|dog walker|for\s+([^.\n]+?)\s+role)/i
    );
    const roleName = roleMatch?.[1]?.trim() || roleMatch?.[0]?.trim() || "dog owner";
    changes.push(`set ${roleName} role description to "${m[1]}"`);
  }

  if (changes.length > 0) {
    return `Update role picker copy in the preview: ${changes.join("; ")}.`;
  }

  return (
    "Update the role picker and onboarding copy in the preview exactly as described " +
    "in the last brainstorm reply."
  );
}

/** Apply role description swaps from an expanded build message (deterministic). */
export function tryApplyRoleCopyFromMessage(
  model: ExpoAppModel,
  message: string
): { model: ExpoAppModel; reply: string } | null {
  if (!model.flow?.roles?.length) return null;
  if (!/role picker|role description|update role picker copy|dog owner|dog walker/i.test(message)) {
    return null;
  }

  let next = model;
  let n = 0;

  const setRe = /set\s+([^:]+?)\s+role\s+description\s+to\s+["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = setRe.exec(message))) {
    const roleName = m[1]!.trim().toLowerCase();
    const text = m[2]!.trim();
    const idx = model.flow!.roles!.findIndex((r) =>
      r.label.toLowerCase().includes(roleName)
    );
    if (idx >= 0) {
      next = setStringAtPath(next, `flow.roles[${idx}].description`, text);
      n++;
    }
  }

  const changeRe = /change\s+["']([^"']+)["']\s+to\s+["']([^"']+)["']/gi;
  while ((m = changeRe.exec(message))) {
    const from = m[1]!.trim().toLowerCase();
    const to = m[2]!.trim();
    const idx = model.flow!.roles!.findIndex((r) =>
      r.description.toLowerCase().includes(from)
    );
    if (idx >= 0) {
      next = setStringAtPath(next, `flow.roles[${idx}].description`, to);
      n++;
    }
  }

  if (n === 0) return null;
  return {
    model: next,
    reply: `Updated ${n} role description${n === 1 ? "" : "s"} on the role picker.`,
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
  context?: string
): string {
  const trimmed = message.trim();

  if (BUILD_COMMAND_RE.test(trimmed) || SHORT_FOLLOWUP_RE.test(trimmed)) {
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
