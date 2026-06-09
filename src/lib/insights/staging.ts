import type { Project } from "@/lib/types";

/** Tag sent with SDK events — filter staging noise in Reports. */
export function analyticsEnvironmentTag(project: Project): "production" | "staging" {
  return project.insightsState?.analyticsEnvironment ?? "production";
}

export function stagingFilterHint(environment: "production" | "staging"): string {
  if (environment === "staging") {
    return "Showing test and preview traffic only. Switch to Production before you judge real launch numbers.";
  }
  return "Showing real user traffic. Your own preview clicks should use test mode in Integrations so they do not count here.";
}

export function shouldWarnStagingPollution(
  environment: "production" | "staging",
  sampleSize: number
): boolean {
  return environment === "production" && sampleSize > 0 && sampleSize < 30;
}
