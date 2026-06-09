import type { Project } from "@/lib/types";
import { countConnectedIntegrations, resolveInsightsDataStage, stageLabel } from "./modes";
import type { IntegrationInsightSnapshot } from "./types";

/** One week after App Store / TestFlight submit before first weekly pull. */
export const REPORTS_WARMUP_MS = 7 * 24 * 60 * 60 * 1000;

export type ReportsPhase = "pre_launch" | "warming_up" | "active";

export function resolveReportsPhase(project: Project): ReportsPhase {
  const submittedAt = project.insightsState?.appSubmittedAt;
  if (!submittedAt) return "pre_launch";
  const elapsed = Date.now() - new Date(submittedAt).getTime();
  if (elapsed < REPORTS_WARMUP_MS) return "warming_up";
  return "active";
}

export function firstReportAt(project: Project): Date | null {
  const submittedAt = project.insightsState?.appSubmittedAt;
  if (!submittedAt) return null;
  return new Date(new Date(submittedAt).getTime() + REPORTS_WARMUP_MS);
}

export function daysUntilFirstReport(project: Project): number | null {
  const at = firstReportAt(project);
  if (!at) return null;
  const remaining = at.getTime() - Date.now();
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / (24 * 60 * 60 * 1000));
}

/** Weekly API pulls and cron only after submit + 7 day warmup. */
export function canRunWeeklyReports(project: Project): boolean {
  if (resolveReportsPhase(project) !== "active") return false;
  return countConnectedIntegrations(project) > 0;
}

export function reportsPhaseMessage(project: Project): string {
  const phase = resolveReportsPhase(project);
  if (phase === "pre_launch") {
    return "Reports start after you submit to TestFlight or the app stores. Connect tools now, but we will not pull data until you ship.";
  }
  const days = daysUntilFirstReport(project);
  if (days === null || days <= 0) return "Your first report is ready to run.";
  if (days === 1) return "First weekly report runs tomorrow. Real users need time before numbers mean something.";
  return `First weekly report in ${days} days. We wait one week after submit so your data is real, not preview noise.`;
}

export function reportsPanelSubtitle(
  project: Project,
  snapshots: IntegrationInsightSnapshot[] = []
): string {
  const phase = resolveReportsPhase(project);
  if (phase === "pre_launch") return "Before you ship";
  if (phase === "warming_up") {
    const days = daysUntilFirstReport(project);
    if (days === 0) return "First report ready soon";
    if (days === 1) return "First report tomorrow";
    return `First report in ${days} days`;
  }
  return stageLabel(resolveInsightsDataStage(project, snapshots));
}
