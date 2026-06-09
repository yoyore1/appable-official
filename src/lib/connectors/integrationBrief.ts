/** Client-safe integration brief detection — no server/LLM imports. */

import type { ConnectorId } from "./catalog";
import { catalogSorted } from "./catalog";
import { connectorsRequestedInMessage, getConnectorDefinition } from "./registry";
import type { BrainstormTurn } from "@/lib/types";
import { founderIntegrationBriefHint } from "@/lib/expoApp/founderVoice";

export const INTEGRATION_BRIEF_REQUEST_RE =
  /\[full integration brief|full integration brief for/i;

/** User is editing copy / UX — not asking to wire an integration. */
const COPY_UX_TURN_RE =
  /\b(copy|wording|label|headline|subtext|shorter|friendlier|clearer|rename|professional|trustworthy|onboarding slide|role picker|cta|button text|hero|title|description|pet owner|dog owner|dog walker)\b/i;

/** User explicitly wants integration / backend help — not incidental product words. */
function connectorsExplicitlyInUserMessage(message: string): ConnectorId[] {
  const m = message.toLowerCase();
  const hits = connectorsRequestedInMessage(message);

  return hits.filter((id) => {
    const def = getConnectorDefinition(id);
    const slug = def.id.replace(/-/g, "[\\s-]?");
    if (new RegExp(`\\b${slug}\\b`, "i").test(m)) return true;
    if (new RegExp(`\\b${def.displayName.replace(/\./g, "\\.")}\\b`, "i").test(m)) {
      return true;
    }

    if (id === "supabase") {
      return /\b(wire|connect|hook up|set up|implement)\b.*\b(auth|messaging|database|backend|accounts?)\b/i.test(
        m
      );
    }

    return /\b(wire|connect|integrate|set up|implement|how do i (use|add)|should i use)\b/i.test(m);
  });
}

function userTurns(history: BrainstormTurn[]): BrainstormTurn[] {
  return history.filter((t) => t.role === "user");
}

/** Integrations the user explicitly asked about in recent brainstorm thread. */
export function connectorsInBrainstormThread(
  history: BrainstormTurn[],
  pinnedIntegrationId?: ConnectorId | null
): ConnectorId[] {
  const recent = userTurns(history)
    .slice(-6)
    .map((t) => t.content)
    .join("\n");
  const hits = new Set(connectorsExplicitlyInUserMessage(recent));
  if (pinnedIntegrationId) hits.add(pinnedIntegrationId);
  return catalogSorted()
    .map((d) => d.id)
    .filter((id) => hits.has(id));
}

/** Primary integration focus — only when the user brought it up. */
export function primaryIntegrationInThread(
  history: BrainstormTurn[],
  pinnedIntegrationId?: ConnectorId | null
): ConnectorId | null {
  if (pinnedIntegrationId) return pinnedIntegrationId;

  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn?.role !== "user") continue;
    const hits = connectorsExplicitlyInUserMessage(turn.content);
    if (hits.length) return hits[0] ?? null;
  }

  return null;
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

  // Copy / UX brainstorm — don't surface Supabase brief.
  if (COPY_UX_TURN_RE.test(prev.content) && !connectorsExplicitlyInUserMessage(prev.content).length) {
    return null;
  }

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
