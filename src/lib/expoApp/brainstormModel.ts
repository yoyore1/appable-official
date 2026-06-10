import { integrations } from "@/lib/config";
import { flashChatComplete } from "@/lib/flashChat";
import { buildChatComplete, type PlanChatMessage } from "@/lib/planChat";
import type { BrainstormTurn } from "@/lib/types";
import { isDeepBrainstormMessage } from "./brainstormContext";
import type { BrainstormIntent } from "./brainstormRetrieve";

export type BrainstormModelTier = "qwen" | "kimi";

const DEEP_SINGLE_ITEM_RE =
  /\b(compare|versus|\bvs\b|trade[- ]?offs?|pros and cons|architecture|best approach|all options|research|strategy|launch plan|everything i need)\b/i;

/**
 * Cursor-style Auto for Brainstorm: Qwen by default, Kimi when the thread needs
 * more intelligence (long context, walkthrough, research-y questions).
 * Uses the same Fireworks Kimi as Expo Build — not interview / initial generate.
 */
export function pickBrainstormModelTier(
  message: string,
  history: BrainstormTurn[],
  intent: BrainstormIntent,
  opts?: { hasAttachments?: boolean }
): BrainstormModelTier {
  if (!integrations.expoBuildModel) return "qwen";

  if (opts?.hasAttachments && message.length > 80) return "kimi";
  if (intent === "full_walkthrough") return "kimi";
  if (isDeepBrainstormMessage(message, history)) return "kimi";

  // Long thread — accumulated product context benefits from Kimi.
  if (history.length >= 12) return "kimi";
  if (history.length >= 8 && message.trim().length > 60) return "kimi";

  // User said "yes / go deeper" after coach offered a walkthrough.
  if (intent === "continuation" && history.length >= 6) return "kimi";

  // One pinned topic but a heavy question.
  if (
    intent === "single_item" &&
    (message.length > 180 || DEEP_SINGLE_ITEM_RE.test(message))
  ) {
    return "kimi";
  }

  // Copy coaching stays on Qwen unless the thread is already deep.
  if (intent === "copy_coaching") {
    if (history.length >= 10 && message.length > 80) return "kimi";
    return "qwen";
  }

  return "qwen";
}

export async function brainstormCoachComplete(
  messages: PlanChatMessage[],
  tier: BrainstormModelTier,
  longForm: boolean
): Promise<{ text: string; tier: BrainstormModelTier }> {
  const kimi = tier === "kimi";
  const opts = {
    temperature: kimi ? 0.72 : 0.78,
    maxTokens: longForm ? (kimi ? 1400 : 650) : kimi ? 900 : 450,
    timeoutMs: kimi ? 90_000 : longForm ? 40_000 : 30_000,
  };

  if (kimi) {
    const { text } = await buildChatComplete(messages, opts);
    if (text.trim()) {
      return { text: text.trim(), tier: "kimi" };
    }
    const fallback = await flashChatComplete(messages, opts);
    return { text: fallback.text.trim(), tier: "qwen" };
  }

  const { text } = await flashChatComplete(messages, opts);
  return { text: text.trim(), tier: "qwen" };
}
