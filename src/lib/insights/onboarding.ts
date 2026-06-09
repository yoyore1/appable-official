import type { Project } from "@/lib/types";
import { countConnectedIntegrations } from "./modes";

export interface OnboardingStep {
  id: number;
  title: string;
  detail: string;
}

export const INSIGHTS_ONBOARDING: OnboardingStep[] = [
  {
    id: 0,
    title: "Connect what helps you grow",
    detail:
      "Open Integrations and add tools for revenue, crashes, or signups. Not sure what you need? Ask in Brainstorm: what should I connect to make more money and lose fewer users?",
  },
  {
    id: 1,
    title: "Paste your keys once",
    detail:
      "One key goes in your app when you ship. One stays in Appable so we can show charts and weekly summaries here. You paste once in Integrations.",
  },
  {
    id: 2,
    title: "See what users actually do",
    detail:
      "In Build, turn on tracking for signups, purchases, and where people drop off. We tailor it to your app so you know what is helping or hurting revenue.",
  },
  {
    id: 3,
    title: "Get it on real phones",
    detail:
      "TestFlight or the app store puts your app in real hands. That is when the numbers start to matter. While you test in preview, use test mode so your own clicks do not skew the report.",
  },
  {
    id: 4,
    title: "Your weekly snapshot",
    detail:
      "One week after you submit to TestFlight or the stores, this fills in every week: charts, plain English, and what to fix next.",
  },
];

export function onboardingProgress(step: number): number {
  return Math.min(100, Math.round(((step + 1) / INSIGHTS_ONBOARDING.length) * 100));
}

/** Derive checklist progress from project shape. */
export function deriveOnboardingStep(project: Project): number {
  const connected = countConnectedIntegrations(project);
  if (!connected) return 0;
  if (!project.expoAppModel) return 1;
  const hasReportsKey = Object.values(project.sdkConnectors ?? {}).some(
    (c) => c?.public.reportsReady
  );
  if (!hasReportsKey && connected <= 1) return 2;
  if (!project.insightsState?.appSubmittedAt) return 3;
  if (!project.insightsState?.latestWeekly) return 4;
  return 4;
}
