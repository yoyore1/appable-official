import type { ConnectorId } from "@/lib/connectors/catalog";
import { getConnectorDefinition } from "@/lib/connectors/registry";
import type { IntegrationInsightSnapshot } from "../types";

/** Ops-style integrations — ship status, not product funnels. */
export function genericOpsInsight(
  connectorId: ConnectorId,
  environment: "production" | "staging",
  detail: string
): IntegrationInsightSnapshot {
  const def = getConnectorDefinition(connectorId);
  return {
    connectorId,
    weekEnding: new Date().toISOString().slice(0, 10),
    environment,
    metrics: {},
    headline: `${def.displayName} connected`,
    summary: detail,
    health: "ok",
    suggestions: [],
  };
}

export function genericWaitingInsight(
  connectorId: ConnectorId,
  environment: "production" | "staging"
): IntegrationInsightSnapshot {
  const def = getConnectorDefinition(connectorId);
  return {
    connectorId,
    weekEnding: new Date().toISOString().slice(0, 10),
    environment,
    metrics: {},
    headline: `Waiting for ${def.displayName} data`,
    summary: "Connected — charts fill in after users interact with this integration.",
    health: "no_data",
    suggestions: [],
  };
}
