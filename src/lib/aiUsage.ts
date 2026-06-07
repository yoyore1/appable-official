/**
 * Capped live AI generations for free builds (~$0.55 per user).
 * Tracks spend so demo features (photo→recipe, etc.) taste real without budget abuse.
 */
export const FREE_AI_BUDGET_USD = 0.55;

/** Hard cap on TTS — priciest per unit ($20 / 1M chars). */
export const TTS_CHAR_CAP_FREE = 2_000;

/** Estimated cost per capability for pre-flight checks (USD). */
export const ESTIMATED_COST_USD: Record<string, number> = {
  vision: 0.004,
  app_code: 0.02,
  cheap_text: 0.001,
  image_gen: 0.014,
  speech_to_text: 0.003,
  text_to_speech: 0.04,
  embedding: 0.0002,
  rerank: 0.0002,
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
    atCap: spentUsd >= budgetUsd,
  };
}

export function canSpend(
  spentUsd: number,
  task: string,
  opts?: { ttsChars?: number; ttsCharsUsed?: number }
): boolean {
  const est = ESTIMATED_COST_USD[task] ?? 0.01;
  if (spentUsd + est > FREE_AI_BUDGET_USD) return false;
  if (task === "text_to_speech" && opts?.ttsChars) {
    const used = opts.ttsCharsUsed ?? 0;
    if (used + opts.ttsChars > TTS_CHAR_CAP_FREE) return false;
  }
  return true;
}

/** User-facing copy when the free cap is hit — framed as level-up, not a wall. */
export const UPGRADE_AT_CAP_MESSAGE =
  "You've used your free AI generations — your app looks amazing. Power it up with your own API key to keep going, save data, and publish.";
