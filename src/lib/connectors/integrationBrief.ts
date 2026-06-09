/** Client-safe integration brief detection — no server/LLM imports. */

import type { ConnectorId } from "./catalog";
import { catalogSorted } from "./catalog";
import { connectorsRequestedInMessage, getConnectorDefinition } from "./registry";
import type { BrainstormTurn } from "@/lib/types";
import { founderIntegrationBriefHint } from "@/lib/expoApp/founderVoice";

export const INTEGRATION_BRIEF_REQUEST_RE =
  /\[full integration brief|full integration brief for/i;

/** Integrations mentioned in recent brainstorm thread. */
export function connectorsInBrainstormThread(
  history: BrainstormTurn[],
  pinnedIntegrationId?: ConnectorId | null
): ConnectorId[] {
  const recent = history
    .slice(-10)
    .map((t) => t.content)
    .join("\n");
  const hits = new Set(connectorsRequestedInMessage(recent));
  if (pinnedIntegrationId) hits.add(pinnedIntegrationId);
  return catalogSorted()
    .map((d) => d.id)
    .filter((id) => hits.has(id));
}

/** Primary integration focus for the current exchange. */
export function primaryIntegrationInThread(
  history: BrainstormTurn[],
  pinnedIntegrationId?: ConnectorId | null
): ConnectorId | null {
  if (pinnedIntegrationId) return pinnedIntegrationId;

  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (!turn) continue;
    const hits = connectorsRequestedInMessage(turn.content);
    if (hits.length) return hits[0] ?? null;
  }

  const thread = connectorsInBrainstormThread(history);
  return thread[0] ?? null;
}

export interface IntegrationBriefHandoff {
  integrationId: ConnectorId;
  label: string;
  hint: string;
  userMessage: string;
}

export function resolveIntegrationBrief(input: {
  history: BrainstormTurn[];
  pinnedIntegrationId?: ConnectorId | null;
  appName: string;
}): IntegrationBriefHandoff | null {
  const { history, pinnedIntegrationId, appName } = input;
  if (history.length < 2) return null;

  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  if (last?.role !== "assistant" || prev?.role !== "user") return null;

  if (INTEGRATION_BRIEF_REQUEST_RE.test(prev.content)) return null;

  const integrationId = primaryIntegrationInThread(history, pinnedIntegrationId);
  if (!integrationId) return null;

  const threadIds = connectorsInBrainstormThread(history, pinnedIntegrationId);
  if (!threadIds.includes(integrationId)) return null;

  const def = getConnectorDefinition(integrationId);

  return {
    integrationId,
    label: `Full ${def.displayName} brief`,
    hint: founderIntegrationBriefHint(appName),
    userMessage: `[Full integration brief · ${def.displayName}] Research this deeply for ${appName}.`,
  };
}
