import type { ConnectorId } from "@/lib/connectors/catalog";

/** Soft free-tier guardrails — normie warnings only. */
const LIMITS: Partial<Record<ConnectorId, { metric: string; warnAt: number; label: string }>> = {
  posthog: { metric: "events", warnAt: 800_000, label: "PostHog free tier (~1M events/mo)" },
  sentry: { metric: "events", warnAt: 4_000, label: "Sentry free tier (~5k errors/mo)" },
  onesignal: { metric: "subscribers", warnAt: 8_000, label: "OneSignal free tier (~10k subs)" },
};

export function limitWarning(
  connectorId: ConnectorId,
  metrics: Record<string, number | string>
): string | undefined {
  const rule = LIMITS[connectorId];
  if (!rule) return undefined;
  const val = metrics[rule.metric];
  if (typeof val !== "number" || val < rule.warnAt) return undefined;
  return `You're near ${rule.label}. Consider upgrading or sampling events.`;
}
