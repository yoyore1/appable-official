import type { BrainstormTurn, ProjectBuildState } from "@/lib/types";
import { isVagueBuildFollowUp } from "./resolveBuildIntent";

export function defaultBuildState(): ProjectBuildState {
  return { history: [] };
}

export function appendBuildTurn(
  state: ProjectBuildState,
  userMessage: string,
  assistantReply: string
): ProjectBuildState {
  const next = [
    ...state.history,
    { role: "user" as const, content: userMessage },
    { role: "assistant" as const, content: assistantReply },
  ].slice(-40) as BrainstormTurn[];
  return { ...state, history: next };
}

const GENERIC_BUILD_FOLLOWUP_RE =
  /whatever is best|whatever'?s best|up to you|you decide|your call|either is fine|do what'?s best|can u do this|can you do this/i;

export function isGenericBuildFollowUp(message: string): boolean {
  return (
    isVagueBuildFollowUp(message) || GENERIC_BUILD_FOLLOWUP_RE.test(message.toLowerCase())
  );
}

/** Expand short Build replies so the agent continues the same task — not brainstorm copy. */
export function enrichBuildUserMessage(
  message: string,
  buildHistory: BrainstormTurn[]
): string {
  const trimmed = message.trim();
  if (!trimmed || !isGenericBuildFollowUp(trimmed)) return trimmed;

  const lastUser = [...buildHistory].reverse().find((t) => t.role === "user");
  const lastAssistant = [...buildHistory].reverse().find((t) => t.role === "assistant");

  if (!lastUser || lastUser.content === trimmed) return trimmed;

  const parts = [
    trimmed,
    `\n\n(Build thread — continue my prior request: "${lastUser.content}".`,
  ];

  if (lastAssistant?.content) {
    parts.push(
      ` Your last Build reply was: "${lastAssistant.content.slice(0, 500)}".`
    );
  }

  parts.push(
    " Execute that plan now. Do not switch to unrelated topics like role structure or random copy unless I asked for that.)"
  );

  return parts.join("");
}

export function buildRetrievalQuery(
  message: string,
  buildHistory: BrainstormTurn[]
): string {
  const trimmed = message.trim();
  if (!isGenericBuildFollowUp(trimmed)) return trimmed;

  const lastUser = [...buildHistory].reverse().find((t) => t.role === "user");
  if (!lastUser || lastUser.content === trimmed) return trimmed;

  return `${lastUser.content} ${trimmed}`.trim();
}

export function formatBuildThreadForPrompt(buildHistory: BrainstormTurn[]): string {
  const recent = buildHistory.slice(-8);
  if (!recent.length) return "";

  return (
    "--- Build thread (continue this — do not drift) ---\n" +
    recent
      .map((t) => `${t.role === "user" ? "Founder" : "Build"}: ${t.content}`)
      .join("\n\n")
  );
}
