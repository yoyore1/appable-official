import type { BrainstormTurn } from "@/lib/types";

const BUILD_SWITCH_RE =
  /\b(switch|flip|head|move|jump|go)\s+(to|over to)\s+\*?\*?build\*?\*?|\b(use|try|open)\s+\*?\*?build\*?\*?\s+(mode|tab)?|\bin\s+\*?\*?build\*?\*?\s*(mode|tab)?\b|\btap\s+\*?\*?build\*?\*?\b|\bclick\s+\*?\*?build\*?\*?\b|\b\*\*build\*\*\s+tab\b/i;

const SHORT_ACK_RE =
  /^(yes|yeah|yep|yup|ok|okay|sure|do it|please|sounds good|let'?s do it|go ahead|perfect)\.?!?$/i;

/** Coach told the user to switch to Build tab. */
export function replySuggestsBuildSwitch(text: string): boolean {
  return BUILD_SWITCH_RE.test(text);
}

function lastBrainstormTurn(
  history: BrainstormTurn[],
  role: "user" | "assistant"
): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.role === role) return history[i]!.content;
  }
  return null;
}

/** Turn the latest brainstorm exchange into a Build-mode instruction. */
export function buildPromptFromExchange(
  history: BrainstormTurn[],
  assistantReply: string
): string {
  const lastUser = lastBrainstormTurn(history, "user")?.trim() ?? "";

  if (lastUser.length >= 12 && !SHORT_ACK_RE.test(lastUser)) {
    return lastUser;
  }

  const cleaned = assistantReply
    .replace(/\*\*/g, "")
    .replace(/\b(switch|flip|head|go)\s+(to|over to)\s+build[^.?\n]*/gi, "")
    .replace(/\b(use|try|tap|click)\s+build[^.?\n]*/gi, "")
    .trim();

  const lines = cleaned
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 12 &&
        !/^switch|^tap|^go to|^when you|^let me know/i.test(l) &&
        !/connections|supabase|checklist/i.test(l)
    );

  const body = lines.slice(0, 3).join(" ").replace(/\s+/g, " ").trim();

  if (body.length > 24) {
    return `Update the app preview with what we just planned: ${body.slice(0, 320)}`;
  }

  return "Update the app preview with what we just discussed in this chat.";
}

/** Floating Build CTA — only when coach mentions Build, prompt from this thread. */
export function resolveBuildHandoff(input: {
  history: BrainstormTurn[];
  assistantReply?: string | null;
}): { show: boolean; label: string; prompt: string } | null {
  const assistant =
    input.assistantReply?.trim() ||
    lastBrainstormTurn(input.history, "assistant") ||
    "";

  if (!replySuggestsBuildSwitch(assistant)) return null;

  const prompt = buildPromptFromExchange(input.history, assistant);

  return {
    show: true,
    label: "Build it",
    prompt,
  };
}
