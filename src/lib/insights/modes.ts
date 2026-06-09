import type { ConnectorId } from "@/lib/connectors/catalog";
import type { Project } from "@/lib/types";
import type { IntegrationInsightSnapshot, InsightsDataStage } from "./types";

const EARLY_THRESHOLD = 50;
const HEALTHY_THRESHOLD = 200;

export function totalSampleSize(snapshots: IntegrationInsightSnapshot[]): number {
  let max = 0;
  for (const s of snapshots) {
    const n = s.sampleSize ?? 0;
    if (typeof n === "number" && n > max) max = n;
  }
  return max;
}

/** Single source of truth: explore vs waiting vs early vs healthy. */
export function resolveInsightsDataStage(
  project: Project,
  snapshots: IntegrationInsightSnapshot[] = project.insightsState?.latestWeekly?.snapshots ?? []
): InsightsDataStage {
  const hasExport = Boolean(project.expoAppModel);
  const connected = countConnectedIntegrations(project);
  if (!connected) return "explore";
  if (!hasExport) return "explore";

  const sample = totalSampleSize(snapshots);
  const anyData = snapshots.some((s) => s.health === "ok" && sample > 0);
  if (!anyData) return "waiting";
  if (sample < EARLY_THRESHOLD) return "early";
  if (sample >= HEALTHY_THRESHOLD) return "healthy";
  return "early";
}

export function countConnectedIntegrations(project: Project): number {
  let n = 0;
  if (project.supabaseConnector?.public.status === "connected") n++;
  if (project.revenueCatConnector?.public.status === "connected") n++;
  if (project.railwayConnector?.public.status === "connected") n++;
  for (const c of Object.values(project.sdkConnectors ?? {})) {
    if (c?.public.status === "connected") n++;
  }
  return n;
}

export function stageLabel(stage: InsightsDataStage): string {
  switch (stage) {
    case "explore":
      return "Setup";
    case "waiting":
      return "Waiting for users";
    case "early":
      return "Early data";
    case "healthy":
      return "Live insights";
  }
}

export function connectedIntegrationIds(project: Project): ConnectorId[] {
  const ids: ConnectorId[] = [];
  if (project.supabaseConnector?.public.status === "connected") ids.push("supabase");
  if (project.revenueCatConnector?.public.status === "connected") ids.push("revenuecat");
  if (project.railwayConnector?.public.status === "connected") ids.push("railway");
  for (const [id, c] of Object.entries(project.sdkConnectors ?? {})) {
    if (c?.public.status === "connected") ids.push(id as ConnectorId);
  }
  return ids;
}
