import type { ProjectRevenueCatConnector } from "@/lib/types";
import { decryptRevenueCatSecrets } from "@/lib/connectors/revenueCatConnector";
import type { IntegrationInsightSnapshot } from "../types";

export async function pullRevenueCatInsight(
  connector: ProjectRevenueCatConnector,
  environment: "production" | "staging"
): Promise<IntegrationInsightSnapshot> {
  const base = {
    connectorId: "revenuecat" as const,
    weekEnding: new Date().toISOString().slice(0, 10),
    environment,
    suggestions: [],
  };

  try {
    let secretApiKey: string;
    try {
      ({ secretApiKey } = decryptRevenueCatSecrets(connector));
    } catch {
      return {
        ...base,
        metrics: {},
        headline: "Could not read RevenueCat keys",
        summary: "Reconnect RevenueCat in Integrations and try again.",
        health: "error",
        errorMessage: "Invalid stored keys",
      };
    }
    const res = await fetch("https://api.revenuecat.com/v1/subscribers/count", {
      headers: {
        Authorization: `Bearer ${secretApiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });

    let count = 0;
    if (res.ok) {
      const data = (await res.json()) as { value?: number };
      count = data.value ?? 0;
    }

    return {
      ...base,
      metrics: { subscribers: count },
      sampleSize: count,
      headline: count ? `${count} tracked subscribers` : "No subscribers yet",
      summary: count
        ? "Revenue data is flowing — open Reports suggestions to improve conversion and churn."
        : "Connect offerings in RevenueCat after you ship paywall in Build.",
      chartBars: [{ label: "Subscribers", value: count, max: Math.max(count, 5) }],
      health: res.ok ? (count > 0 ? "ok" : "no_data") : "error",
      errorMessage: res.ok ? undefined : `RevenueCat API ${res.status}`,
    };
  } catch (e) {
    return {
      ...base,
      metrics: {},
      headline: "Could not read RevenueCat",
      summary: "Verify secret API key in Integrations.",
      health: "error",
      errorMessage: e instanceof Error ? e.message : "RevenueCat error",
    };
  }
}
