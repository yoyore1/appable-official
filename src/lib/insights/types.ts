import type { ConnectorId } from "@/lib/connectors/catalog";

export type InsightsDataStage = "explore" | "waiting" | "early" | "healthy";

export type InsightHealth = "ok" | "no_data" | "error" | "not_configured";

export type InsightSuggestionKind = "explain" | "ask" | "build";

export interface InsightSuggestion {
  id: string;
  label: string;
  prompt: string;
  mode: "explore" | "insights";
  kind: InsightSuggestionKind;
  buildPrompt?: string;
  acceptanceCriteria?: string;
}

export interface InsightChartBar {
  label: string;
  value: number;
  max?: number;
}

export interface IntegrationInsightSnapshot {
  connectorId: ConnectorId;
  weekEnding: string;
  metrics: Record<string, number | string>;
  headline: string;
  summary: string;
  suggestions: InsightSuggestion[];
  chartBars?: InsightChartBar[];
  health: InsightHealth;
  errorMessage?: string;
  sampleSize?: number;
  environment: "production" | "staging" | "mixed";
  limitWarning?: string;
}

export interface InsightsWeeklyBundle {
  weekEnding: string;
  generatedAt: string;
  snapshots: IntegrationInsightSnapshot[];
  overallHeadline: string;
}

export interface ProjectInsightsState {
  onboardingStep: number;
  onboardingDone?: boolean;
  lastWeeklyRunAt?: string | null;
  lastLivePullAt?: string | null;
  latestWeekly?: InsightsWeeklyBundle | null;
  weeklyHistory?: InsightsWeeklyBundle[];
  emailWeeklyEnabled?: boolean;
  analyticsEnvironment: "production" | "staging";
  privacyAcknowledgedAt?: string | null;
  lastBuildFromInsightId?: string | null;
  /** When founder submitted to TestFlight / app stores — weekly pulls start 7 days later. */
  appSubmittedAt?: string | null;
}

export const defaultInsightsState = (): ProjectInsightsState => ({
  onboardingStep: 0,
  analyticsEnvironment: "production",
  emailWeeklyEnabled: true,
  latestWeekly: null,
  weeklyHistory: [],
});
