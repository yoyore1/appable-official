import type { ProjectSupabaseConnector } from "@/lib/types";
import { decryptSupabaseConnectorSecrets } from "@/lib/connectors/supabaseConnector";
import type { IntegrationInsightSnapshot } from "../types";

export async function pullSupabaseInsight(
  connector: ProjectSupabaseConnector,
  environment: "production" | "staging"
): Promise<IntegrationInsightSnapshot> {
  const base = {
    connectorId: "supabase" as const,
    weekEnding: new Date().toISOString().slice(0, 10),
    environment,
    suggestions: [],
  };

  try {
    let url: string;
    let serviceRoleKey: string;
    try {
      ({ url, serviceRoleKey } = decryptSupabaseConnectorSecrets(connector));
    } catch {
      return {
        ...base,
        metrics: {},
        headline: "Could not read Supabase keys",
        summary: "Reconnect Supabase in Integrations and try again.",
        health: "error",
        errorMessage: "Invalid stored keys",
      };
    }
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/profiles?select=id`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: "count=exact",
      },
      signal: AbortSignal.timeout(10_000),
    });

    let count = 0;
    if (res.ok) {
      const range = res.headers.get("content-range");
      const m = range?.match(/\/(\d+)$/);
      if (m) count = parseInt(m[1]!, 10);
    }

    return {
      ...base,
      metrics: { profiles: count, signups: count },
      sampleSize: count,
      headline: count ? `${count} profiles in database` : "No profile rows yet",
      summary: count
        ? "Real accounts in Supabase — compare to PostHog signups to spot tracking gaps."
        : "Auth may be wired but no profiles yet — normal before first users.",
      chartBars: [{ label: "Profiles", value: count, max: Math.max(count, 10) }],
      health: count > 0 ? "ok" : "no_data",
    };
  } catch (e) {
    return {
      ...base,
      metrics: {},
      headline: "Could not read Supabase",
      summary: "Check Supabase connection and profiles table.",
      health: "error",
      errorMessage: e instanceof Error ? e.message : "Supabase error",
    };
  }
}
