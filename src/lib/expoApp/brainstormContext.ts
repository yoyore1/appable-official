import type {
  BrainstormBuildSuggestion,
  BrainstormTurn,
  ProjectBrainstormState,
  ProjectReadinessState,
} from "@/lib/types";
import { buildAgentBuiltStateBlock } from "./builtState";
import type { ReadinessItem } from "./readinessAudit";
import type { ExpoAppModel } from "./types";

export function defaultBrainstormState(): ProjectBrainstormState {
  return { history: [], summary: "", pendingBuild: null };
}

const FALLBACK_WALKTHROUGH_OFFER =
  /want a quick take or a full walkthrough/i;

/** Longer Qwen reply when the user wants a full walkthrough or research. */
export function isDeepBrainstormMessage(
  message: string,
  history: BrainstormTurn[]
): boolean {
  const m = message.toLowerCase().trim();
  if (message.length > 200) return true;
  if ((message.match(/\?/g) ?? []).length >= 2) return true;
  if (history.length >= 8 && message.length > 120) return true;

  if (
    /walk\s*through|walkthrough|walkhtrough|full walk|deep dive|full breakdown|tell me everything|explain everything/i.test(
      m
    )
  ) {
    return true;
  }

  const lastAssistant = [...history].reverse().find((t) => t.role === "assistant");
  if (
    lastAssistant &&
    FALLBACK_WALKTHROUGH_OFFER.test(lastAssistant.content) &&
    /^(yes|yeah|yep|sure|ok|okay|full|walk|deep|do it|go ahead)\b/i.test(m)
  ) {
    return true;
  }

  return (
    /compare|versus|\bvs\b|research|architecture|pros and cons|all options|explain (everything|in detail)|walk me through|step[- ]by[- ]step|everything i need|how does .+ work|what are my options|best approach|trade[- ]?offs?/i.test(
      m
    )
  );
}

export function appendBrainstormTurn(
  state: ProjectBrainstormState,
  userMessage: string,
  assistantReply: string
): ProjectBrainstormState {
  const next: BrainstormTurn[] = [
    ...state.history,
    { role: "user", content: userMessage },
    { role: "assistant", content: assistantReply },
  ].slice(-40);
  return { ...state, history: next };
}

/** Drop edited turn and everything after (Claude-style edit & resend). */
export function truncateBrainstormHistory(
  state: ProjectBrainstormState,
  turnIndex: number
): ProjectBrainstormState {
  const safe = Math.max(0, Math.min(turnIndex, state.history.length));
  return {
    ...state,
    history: state.history.slice(0, safe),
    pendingBuild: null,
  };
}

export function summarizeReadinessForBuild(
  items: ReadinessItem[],
  state: ProjectReadinessState | null | undefined
): string {
  if (!state?.items || Object.keys(state.items).length === 0) return "";

  const lines: string[] = [];
  for (const item of items) {
    const us = state.items[item.id];
    if (!us?.discussed && !us?.decision) continue;
    const decision = us.decision
      ? { done: "done", yes: "need this", later: "later", skip: "skip" }[us.decision]
      : "discussed";
    lines.push(`- ${item.title}: ${decision}`);
  }
  return lines.length ? `Checklist decisions:\n${lines.join("\n")}` : "";
}

/** Context block injected into the Build agent on every tweak. */
export function formatBrainstormContextForBuild(
  brainstorm: ProjectBrainstormState | null | undefined,
  readinessNote?: string,
  connectorNote?: string,
  previewModel?: ExpoAppModel | null
): string {
  const parts: string[] = [];

  if (previewModel) {
    parts.push(buildAgentBuiltStateBlock(previewModel));
  }

  if (connectorNote?.trim()) {
    parts.push(`Connections:\n${connectorNote.trim()}`);
  }

  if (brainstorm?.summary?.trim()) {
    parts.push(`Brainstorm summary (what the user planned):\n${brainstorm.summary.trim()}`);
  }

  const recent = brainstorm?.history.slice(-10) ?? [];
  if (recent.length > 0) {
    parts.push(
      "Recent brainstorm:\n" +
        recent.map((t) => `${t.role === "user" ? "User" : "Coach"}: ${t.content}`).join("\n")
    );
  }

  if (readinessNote?.trim()) parts.push(readinessNote.trim());

  return parts.join("\n\n");
}

/** Expand vague follow-ups ("full walkthrough", "yes") so the model answers the real thread. */
export function enrichBrainstormUserMessage(
  message: string,
  history: BrainstormTurn[],
  pinnedItem?: { title: string; plainWhy: string } | null
): string {
  const trimmed = message.trim();
  const shortFollowUp =
    trimmed.length < 48 &&
    /^(yes|yeah|yep|sure|ok|okay|full|walk|deep|continue|go ahead|tell me more|explain)/i.test(
      trimmed
    );

  const lastUser = [...history].reverse().find((t) => t.role === "user");
  const parts: string[] = [trimmed];

  if (shortFollowUp && lastUser && lastUser.content !== trimmed) {
    parts.push(
      `\n\n(Context: I'm continuing from my earlier message — "${lastUser.content}". Answer that topic in depth for this specific app.)`
    );
  }

  if (pinnedItem) {
    parts.push(
      `\n\n(Focus area: "${pinnedItem.title}" — ${pinnedItem.plainWhy}. Tie your answer to this.)`
    );
  }

  if (parts.length === 1) {
    parts.push(
      "\n\n(Use everything you know about this app's preview, plan, and checklist — be specific to this app, not generic.)"
    );
  }

  return parts.join("");
}

export function parseBuildSuggestionJson(
  raw: string
): BrainstormBuildSuggestion | null {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as {
      suggest?: boolean;
      label?: string;
      prompt?: string;
    };
    if (
      parsed.suggest &&
      typeof parsed.label === "string" &&
      typeof parsed.prompt === "string" &&
      parsed.prompt.trim().length > 8
    ) {
      return {
        label: parsed.label.trim().slice(0, 48),
        prompt: parsed.prompt.trim().slice(0, 500),
      };
    }
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return parseBuildSuggestionJson(trimmed.slice(start, end + 1));
    }
  }
  return null;
}
