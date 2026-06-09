import type { Project } from "@/lib/types";
import { pullAllInsights } from "./providers";
import { overallWeeklyHeadline } from "./summarize";
import { deriveOnboardingStep } from "./onboarding";
import {
  defaultInsightsState,
  type InsightsWeeklyBundle,
  type ProjectInsightsState,
} from "./types";

export async function runWeeklyInsightsForProject(
  project: Project
): Promise<{ state: ProjectInsightsState; bundle: InsightsWeeklyBundle }> {
  const prior = project.insightsState ?? defaultInsightsState();
  const snapshots = await pullAllInsights(project);
  const weekEnding = new Date().toISOString().slice(0, 10);
  const overallHeadline = await overallWeeklyHeadline(project, snapshots);

  const bundle: InsightsWeeklyBundle = {
    weekEnding,
    generatedAt: new Date().toISOString(),
    snapshots,
    overallHeadline,
  };

  const history = [...(prior.weeklyHistory ?? [])];
  history.unshift(bundle);
  if (history.length > 12) history.length = 12;

  const step = Math.max(prior.onboardingStep, deriveOnboardingStep(project), 4);
  const state: ProjectInsightsState = {
    ...prior,
    lastWeeklyRunAt: bundle.generatedAt,
    latestWeekly: bundle,
    weeklyHistory: history,
    onboardingStep: step,
    onboardingDone: step >= 4,
  };

  return { state, bundle };
}
