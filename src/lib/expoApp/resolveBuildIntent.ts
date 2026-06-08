import type { BrainstormTurn } from "@/lib/types";

const SHORT_FOLLOWUP_RE =
  /^(yes|yeah|yep|yup|sure|ok|okay|do it|go ahead|proceed|please|let'?s do it|let'?s go|sounds good)\.?!?$/i;

const READY_TO_BUILD_RE =
  /\b(ready|rdy)\b.*\bbuild\b|\bbuild it\b|\bso we\b.*\bbuild\b|\bwant to proceed\b|\bcreate the tables\b|\blet'?s create\b.*\btable/i;

const BUILD_VERB_RE =
  /\b(build|wire|implement|create|add|set up|hook up|make)\b/i;

export type InferredBuildTask = "messaging" | "auth" | "sign_out" | null;

function recentBlob(history: BrainstormTurn[], context?: string, maxTurns = 8): string {
  const turns = history.slice(-maxTurns).map((t) => t.content);
  return `${turns.join("\n")}\n${context ?? ""}`.toLowerCase();
}

/** User confirmed in Build without repeating the topic ("yes", "ready to build it?"). */
export function isVagueBuildFollowUp(message: string): boolean {
  const t = message.trim();
  if (t.length > 96) return false;
  return SHORT_FOLLOWUP_RE.test(t) || READY_TO_BUILD_RE.test(t);
}

export function inferBuildTaskFromContext(
  history: BrainstormTurn[],
  context?: string
): InferredBuildTask {
  const blob = recentBlob(history, context);

  if (
    /conversation|messages?\s+table|messaging|sender_id|message list|in-app chat|chat thread|appable_messages|appable_conversations/.test(
      blob
    )
  ) {
    return "messaging";
  }

  if (
    /sign[\s-]?out|delete account|account controls/.test(blob) &&
    /profile|settings/.test(blob)
  ) {
    return "sign_out";
  }

  if (
    /sign[\s-]?up|sign[\s-]?in|auth|google login|apple login|supabase auth|create a user|register/.test(
      blob
    )
  ) {
    return "auth";
  }

  return null;
}

/** Expand short Build messages using recent brainstorm thread. */
export function resolveEffectiveBuildMessage(
  message: string,
  history: BrainstormTurn[] = [],
  context?: string
): string {
  const trimmed = message.trim();
  if (!isVagueBuildFollowUp(trimmed)) return trimmed;

  const task = inferBuildTaskFromContext(history, context);
  const lastCoach = [...history].reverse().find((t) => t.role === "assistant")?.content ?? "";

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

  if (
    /conversation|messages?\s+table|messaging|schema|supabase tables/i.test(lastCoach) &&
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
  const resolved = resolveEffectiveBuildMessage(message, history, context);
  if (resolved !== message.trim()) return resolved;

  const m = message.toLowerCase();
  const task = inferBuildTaskFromContext(history, context);
  const expanded = task ? taskToBuildMessage(task) : null;

  if (expanded && (isBuildExecutionMessage(message) || BUILD_VERB_RE.test(m))) {
    return expanded;
  }

  if (BUILD_VERB_RE.test(m) && /messag|chat|inbox|conversation/.test(m)) {
    return taskToBuildMessage("messaging")!;
  }
  if (BUILD_VERB_RE.test(m) && /sign[\s-]?up|sign[\s-]?in|auth|login|register/.test(m)) {
    return taskToBuildMessage("auth")!;
  }

  return resolved;
}
