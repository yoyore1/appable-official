import type { MasterBuildPrompt } from "@/lib/types";
import type { ExpoAppModel } from "@/lib/expoApp/types";
import { eventCatalogForProject } from "./eventCatalog";

/**
 * Future: create PostHog dashboards via Management API when Reports key is present.
 * Today: returns event + funnel IDs for Build to instrument (catalog-driven).
 */
export function posthogProvisionPlan(
  mp: MasterBuildPrompt,
  model?: ExpoAppModel | null
): { events: string[]; funnelSteps: string[]; dashboardName: string } {
  const { events, funnels, profile } = eventCatalogForProject(mp, model);
  const funnelSteps = funnels[0]?.steps ?? ["signup_completed", "screen_view"];
  return {
    events: events.map((e) => e.id),
    funnelSteps,
    dashboardName: `${mp.appName} — ${profile} funnel`,
  };
}
