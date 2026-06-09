import type { ProjectSdkConnector } from "@/lib/types";
import { decryptSdkSecrets } from "@/lib/connectors/sdkConnector";
import { limitWarning } from "../limits";
import type { IntegrationInsightSnapshot } from "../types";

export async function pullSentryInsight(
  connector: ProjectSdkConnector,
  environment: "production" | "staging"
): Promise<IntegrationInsightSnapshot> {
  const base = {
    connectorId: "sentry" as const,
    weekEnding: new Date().toISOString().slice(0, 10),
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
      headline: "Could not read Sentry keys",
      summary: "Reconnect Sentry in Integrations and paste your keys again.",
      health: "error",
      errorMessage: "Invalid stored keys",
    };
  }

  const token = secrets.authToken;

  if (!token) {
    return {
      ...base,
      metrics: {},
      headline: "Add Auth token for crash Reports",
      summary: "DSN sends crashes from the app. Auth token lets Appable summarize stability here.",
      health: "not_configured",
    };
  }

  try {
    const orgRes = await fetch("https://sentry.io/api/0/organizations/", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!orgRes.ok) throw new Error(`Sentry orgs ${orgRes.status}`);
    const orgs = (await orgRes.json()) as { slug: string }[];
    const slug = orgs[0]?.slug;
    if (!slug) throw new Error("No Sentry org");

    const projRes = await fetch(`https://sentry.io/api/0/organizations/${slug}/projects/`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!projRes.ok) throw new Error(`Sentry projects ${projRes.status}`);
    const projects = (await projRes.json()) as { slug: string }[];
    const projectSlug = projects[0]?.slug;
    if (!projectSlug) throw new Error("No Sentry project");

    const issuesRes = await fetch(
      `https://sentry.io/api/0/projects/${slug}/${projectSlug}/issues/?statsPeriod=7d&query=is:unresolved`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12_000) }
    );
    const issues = issuesRes.ok
      ? ((await issuesRes.json()) as { title?: string; count?: string }[])
      : [];
    const issueCount = issues.length;
    const top = issues[0]?.title ?? "None";

    const metrics = { events: issueCount, unresolved: issueCount };
    return {
      ...base,
      metrics,
      sampleSize: issueCount,
      headline: issueCount ? `${issueCount} unresolved issues` : "No crashes this week",
      summary: issueCount
        ? `Top issue: ${top}. Fix stability before marketing spend.`
        : "Crash-free week — keep monitoring after each Build.",
      chartBars: [
        { label: "Unresolved", value: issueCount, max: Math.max(issueCount, 5) },
      ],
      health: "ok",
      limitWarning: limitWarning("sentry", metrics),
    };
  } catch (e) {
    return {
      ...base,
      metrics: {},
      headline: "Could not read Sentry",
      summary: "Verify Auth token has project:read scope.",
      health: "error",
      errorMessage: e instanceof Error ? e.message : "Sentry API error",
    };
  }
}
