import type {
  RailwayConnectorPublic,
  RevenueCatConnectorPublic,
  SupabaseConnectorPublic,
} from "@/lib/types";
import type { AppReadinessAudit } from "@/lib/expoApp/readinessAudit";
import {
  applyConnectorRegistryToAudit,
  type ProjectConnectorState,
} from "./registry";

/** Reflect linked connectors on checklist rows — delegates to connector registry. */
export function applyConnectorsToAudit(
  audit: AppReadinessAudit,
  supabase: SupabaseConnectorPublic | null | undefined,
  revenueCat: RevenueCatConnectorPublic | null | undefined,
  railway?: RailwayConnectorPublic | null | undefined
): AppReadinessAudit {
  const state: ProjectConnectorState = {
    supabase: supabase ?? null,
    revenueCat: revenueCat ?? null,
    railway: railway ?? null,
    sdk: {},
  };
  return applyConnectorRegistryToAudit(audit, state);
}

/** @deprecated Use applyConnectorsToAudit */
export function applySupabaseConnectorToAudit(
  audit: AppReadinessAudit,
  connector: SupabaseConnectorPublic | null | undefined
): AppReadinessAudit {
  return applyConnectorsToAudit(audit, connector, null, null);
}
