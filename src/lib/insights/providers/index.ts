import type { ConnectorId } from "@/lib/connectors/catalog";
import type { Project } from "@/lib/types";
import { analyticsEnvironmentTag } from "../staging";
import { suggestionsForIntegration, rankSuggestions } from "../suggestions";
import { resolveInsightsDataStage } from "../modes";
import type { IntegrationInsightSnapshot } from "../types";
import { pullPostHogInsight } from "./posthog";
import { pullSentryInsight } from "./sentry";
import { pullSupabaseInsight } from "./supabase";
import { pullRevenueCatInsight } from "./revenuecat";
import { genericOpsInsight, genericWaitingInsight } from "./generic";
import { summarizeSnapshot } from "../summarize";

export async function pullIntegrationInsight(
  project: Project,
  connectorId: ConnectorId
): Promise<IntegrationInsightSnapshot> {
  const env = analyticsEnvironmentTag(project);
  let snapshot: IntegrationInsightSnapshot;

  try {
  switch (connectorId) {
    case "posthog": {
      const c = project.sdkConnectors?.posthog;
      if (!c) return genericWaitingInsight(connectorId, env);
      snapshot = await pullPostHogInsight(
        c,
        project.masterPrompt,
        project.expoAppModel,
        env
      );
      break;
    }
    case "sentry": {
      const c = project.sdkConnectors?.sentry;
      if (!c) return genericWaitingInsight(connectorId, env);
      snapshot = await pullSentryInsight(c, env);
      break;
    }
    case "supabase": {
      const c = project.supabaseConnector;
      if (!c) return genericWaitingInsight(connectorId, env);
      snapshot = await pullSupabaseInsight(c, env);
      break;
    }
    case "revenuecat": {
      const c = project.revenueCatConnector;
      if (!c) return genericWaitingInsight(connectorId, env);
      snapshot = await pullRevenueCatInsight(c, env);
      break;
    }
    case "github":
      snapshot = genericOpsInsight(
        connectorId,
        env,
        "Export sync and repo health — ship checklist lives in launch readiness."
      );
      break;
    case "eas-build":
      snapshot = genericOpsInsight(
        connectorId,
        env,
        "Cloud builds via EAS — check expo.dev for latest build status."
      );
      break;
    case "app-store-connect":
      snapshot = genericOpsInsight(
        connectorId,
        env,
        "TestFlight and store metadata automation — ops, not user analytics."
      );
      break;
    case "crisp":
      snapshot = genericOpsInsight(
        connectorId,
        env,
        "Support inbox — watch for recurring questions to feed Build."
      );
      break;
    default:
      if (project.sdkConnectors?.[connectorId]) {
        snapshot = genericWaitingInsight(connectorId, env);
      } else {
        snapshot = genericWaitingInsight(connectorId, env);
      }
  }
  } catch (e) {
    return {
      connectorId,
      weekEnding: new Date().toISOString().slice(0, 10),
      environment: env,
      metrics: {},
      headline: `Could not read ${connectorId}`,
      summary: "Reconnect this integration in Integrations and try again.",
      suggestions: [],
      health: "error",
      errorMessage: e instanceof Error ? e.message : "Pull failed",
    };
  }

  const stage = resolveInsightsDataStage(project, [snapshot]);
  const suggestions = rankSuggestions(
    suggestionsForIntegration(connectorId, stage, snapshot),
    snapshot
  );

  const enriched = await summarizeSnapshot(project, { ...snapshot, suggestions });
  return enriched;
}

export async function pullAllInsights(project: Project): Promise<IntegrationInsightSnapshot[]> {
  const ids: ConnectorId[] = [];
  if (project.supabaseConnector?.public.status === "connected") ids.push("supabase");
  if (project.revenueCatConnector?.public.status === "connected") ids.push("revenuecat");
  if (project.railwayConnector?.public.status === "connected") ids.push("railway");
  for (const [id, c] of Object.entries(project.sdkConnectors ?? {})) {
    if (c?.public.status === "connected") ids.push(id as ConnectorId);
  }
  for (const id of project.marketplaceSelections ?? []) {
    if (!ids.includes(id)) ids.push(id);
  }

  const unique = [...new Set(ids)];
  const snapshots = await Promise.all(
    unique.map((id) => pullIntegrationInsight(project, id))
  );
  return snapshots;
}
