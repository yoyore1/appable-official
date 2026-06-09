import type { MasterBuildPrompt } from "@/lib/types";
import type { ProjectSdkConnector } from "@/lib/types";
import { decryptSdkSecrets } from "@/lib/connectors/sdkConnector";
import { eventCatalogForProject } from "../eventCatalog";
import { limitWarning } from "../limits";
import type { IntegrationInsightSnapshot } from "../types";
import type { ExpoAppModel } from "@/lib/expoApp/types";

function weekEnding(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function pullPostHogInsight(
  connector: ProjectSdkConnector,
  mp: MasterBuildPrompt | null,
  model: ExpoAppModel | null,
  environment: "production" | "staging"
): Promise<IntegrationInsightSnapshot> {
  const base = {
    connectorId: "posthog" as const,
    weekEnding: weekEnding(),
    environment,
    suggestions: [],
  };

  let secrets: Record<string, string> = {};
  try {
    secrets = decryptSdkSecrets(connector);
  } catch {
    return {
      ...base,
      metrics: {},
      headline: "Could not read PostHog keys",
      summary: "Reconnect PostHog in Integrations and paste your keys again.",
      chartBars: [],
      health: "error",
      errorMessage: "Invalid stored keys",
    };
  }

  const host = (secrets.host ?? "https://us.i.posthog.com").replace(/\/$/, "");
  const personalKey = secrets.personalApiKey;

  if (!personalKey) {
    return {
      ...base,
      metrics: {},
      headline: "Add Reports key for PostHog charts",
      summary:
        "App events may be flowing, but Appable needs your Personal API key to read funnels and show weekly Reports here.",
      chartBars: [],
      health: "not_configured",
      errorMessage: "Missing personalApiKey",
    };
  }

  try {
    const apiHost = host.includes("i.posthog") ? host.replace(".i.", ".") : host;
    const projectsRes = await fetch(`${apiHost}/api/projects/`, {
      headers: { Authorization: `Bearer ${personalKey}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!projectsRes.ok) throw new Error(`PostHog projects ${projectsRes.status}`);
    const projects = (await projectsRes.json()) as { results?: { id: number; name: string }[] };
    const projectId = projects.results?.[0]?.id;
    if (!projectId) throw new Error("No PostHog project found");

    const { funnels } = mp ? eventCatalogForProject(mp, model) : { funnels: [] as { steps: string[] }[] };
    const steps = funnels[0]?.steps ?? ["signup_completed", "screen_view"];
    const bars: { label: string; value: number }[] = [];
    let total = 0;

    for (const step of steps.slice(0, 5)) {
      const res = await fetch(
        `${apiHost}/api/projects/${projectId}/events/?event=${encodeURIComponent(step)}&limit=1`,
        {
          headers: { Authorization: `Bearer ${personalKey}` },
          signal: AbortSignal.timeout(10_000),
        }
      );
      let count = 0;
      if (res.ok) {
        const data = (await res.json()) as { results?: unknown[] };
        count = data.results?.length ?? 0;
        const countHeader = res.headers.get("x-total-count");
        if (countHeader) count = parseInt(countHeader, 10) || count;
      }
      bars.push({ label: step.replace(/_/g, " "), value: count });
      total += count;
    }

    const first = bars[0]?.value ?? 0;
    const last = bars[bars.length - 1]?.value ?? 0;
    const conversionPct = first > 0 ? Math.round((last / first) * 1000) / 10 : 0;
    let dropStep = "";
    for (let i = 1; i < bars.length; i++) {
      const prev = bars[i - 1]!.value;
      const cur = bars[i]!.value;
      if (prev > 0 && cur / prev < 0.5) {
        dropStep = bars[i]!.label;
        break;
      }
    }

    const metrics: Record<string, number | string> = {
      events: total,
      conversionPct,
      ...(dropStep ? { dropOffStep: dropStep } : {}),
    };

    const limit = limitWarning("posthog", metrics);

    return {
      ...base,
      metrics,
      sampleSize: first,
      headline: dropStep
        ? `Biggest drop at ${dropStep}`
        : first === 0
          ? "Waiting for events"
          : `Funnel conversion ${conversionPct}%`,
      summary:
        first === 0
          ? "No production events yet — ship or test on device after Build wires tracking."
          : `Tracked ${first} users at top of funnel. ${dropStep ? `Largest leak: ${dropStep} — product UX, not user pricing.` : "Funnel looks stable for early data."}`,
      chartBars: bars.map((b) => ({ ...b, max: first || 1 })),
      health: first > 0 ? "ok" : "no_data",
      limitWarning: limit,
    };
  } catch (e) {
    return {
      ...base,
      metrics: {},
      headline: "Could not read PostHog",
      summary: "Check Personal API key and host region (US vs EU).",
      health: "error",
      errorMessage: e instanceof Error ? e.message : "PostHog API error",
    };
  }
}
