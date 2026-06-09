import type { InsightSuggestion, IntegrationInsightSnapshot } from "./types";

export function buildHandoffFromInsight(
  snapshot: IntegrationInsightSnapshot,
  suggestion: InsightSuggestion
): { prompt: string; acceptanceCriteria?: string } {
  const metrics = Object.entries(snapshot.metrics)
    .slice(0, 6)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const base =
    suggestion.buildPrompt ??
    `Address this insight for ${snapshot.connectorId}: ${snapshot.headline}. Context: ${metrics}`;

  const prompt = `${base} Acceptance: ${suggestion.acceptanceCriteria ?? snapshot.headline}`;

  return {
    prompt,
    acceptanceCriteria: suggestion.acceptanceCriteria ?? `Improve ${snapshot.headline} next week.`,
  };
}

export function compareWeekOverWeek(
  current: IntegrationInsightSnapshot,
  prior?: IntegrationInsightSnapshot | null
): string | null {
  if (!prior) return null;
  const cur = current.metrics.conversionPct;
  const prev = prior.metrics.conversionPct;
  if (typeof cur !== "number" || typeof prev !== "number") return null;
  const delta = cur - prev;
  if (Math.abs(delta) < 0.5) return "Flat vs last week";
  return delta > 0 ? `Up ${delta.toFixed(1)}% vs last week` : `Down ${Math.abs(delta).toFixed(1)}% vs last week`;
}
