/**
 * Capped live AI for free tier (~$0.55 per user).
 * Spend is recorded from DeepInfra `usage.estimated_cost` / `inference_status.cost` — not flat estimates.
 */
export const FREE_AI_BUDGET_USD = 0.55;

/** Hard cap on TTS — priciest per unit ($20 / 1M chars). */
export const TTS_CHAR_CAP_FREE = 2_000;

/** @deprecated Legacy reference only — billing uses real provider cost, not these values. */
export const ESTIMATED_COST_USD: Record<string, number> = {
  vision: 0.004,
  cheap_text: 0.001,
  image_gen: 0.014,
  speech_to_text: 0.003,
  text_to_speech: 0.04,
  embedding: 0.0002,
  rerank: 0.0002,
  /** fal.ai Seedance — no cost in API response; flat estimate only. */
  ad_video: 0.33,
};

export interface AiUsageSnapshot {
  spentUsd: number;
  budgetUsd: number;
  remainingUsd: number;
  ttsCharsUsed: number;
  ttsCharCap: number;
  atCap: boolean;
}

/** User-facing only — never expose dollars in the UI. */
export interface PublicAiUsage {
  /** 0–100 — share of the free allowance still available. */
  remainingPercent: number;
  /** 0–100 — share already consumed (inverse of remaining when at 0 spend). */
  usedPercent: number;
  atCap: boolean;
}

/** Convert internal USD spend to % remaining (0–100). */
export function remainingPercent(
  spentUsd: number,
  budgetUsd: number = FREE_AI_BUDGET_USD
): number {
  if (budgetUsd <= 0) return 0;
  const rem = Math.max(0, budgetUsd - spentUsd);
  return Math.round((rem / budgetUsd) * 100);
}

/** Convert internal USD spend to % used (0–100). */
export function usedPercent(
  spentUsd: number,
  budgetUsd: number = FREE_AI_BUDGET_USD
): number {
  if (budgetUsd <= 0) return 100;
  return Math.min(100, Math.round((spentUsd / budgetUsd) * 100));
}

/** What we send to the client — percentages only, no dollar amounts. */
export function publicUsageSnapshot(
  spentUsd: number,
  budgetUsd: number = FREE_AI_BUDGET_USD
): PublicAiUsage {
  const atCap = spentUsd >= budgetUsd;
  return {
    remainingPercent: remainingPercent(spentUsd, budgetUsd),
    usedPercent: usedPercent(spentUsd, budgetUsd),
    atCap,
  };
}

export function usageSnapshot(
  spentUsd: number,
  ttsCharsUsed = 0
): AiUsageSnapshot {
  const budgetUsd = FREE_AI_BUDGET_USD;
  const remainingUsd = Math.max(0, budgetUsd - spentUsd);
  return {
    spentUsd,
    budgetUsd,
    remainingUsd,
    ttsCharsUsed,
    ttsCharCap: TTS_CHAR_CAP_FREE,
    atCap: isAtAiCap(spentUsd, budgetUsd),
  };
}

export function isAtAiCap(
  spentUsd: number,
  budgetUsd: number = FREE_AI_BUDGET_USD
): boolean {
  return spentUsd >= budgetUsd;
}

/** Pre-flight: block only when already at cap (charges use real provider cost). */
export function canSpend(
  spentUsd: number,
  task?: string,
  opts?: { ttsChars?: number; ttsCharsUsed?: number }
): boolean {
  if (isAtAiCap(spentUsd)) return false;
  if (task === "text_to_speech" && opts?.ttsChars) {
    const used = opts.ttsCharsUsed ?? 0;
    if (used + opts.ttsChars > TTS_CHAR_CAP_FREE) return false;
  }
  return true;
}

/** User-facing copy when the free cap is hit — framed as level-up, not a wall. */
export const UPGRADE_AT_CAP_MESSAGE =
  "You've used your free AI generations — your app looks amazing. Power it up with your own API key to keep going, save data, and publish.";
