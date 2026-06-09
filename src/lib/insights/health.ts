import type { ConnectorId } from "@/lib/connectors/catalog";
import type { Project } from "@/lib/types";
import { getSdkSpec } from "@/lib/connectors/sdkCatalog";

export interface ConnectionHealth {
  connectorId: ConnectorId;
  ok: boolean;
  message: string;
}

export function sdkConnectionHealth(
  project: Project,
  id: ConnectorId
): ConnectionHealth {
  const conn = project.sdkConnectors?.[id];
  if (!conn || conn.public.status !== "connected") {
    return { connectorId: id, ok: false, message: "Not connected" };
  }
  try {
    const spec = getSdkSpec(id);
    const reportsFields = spec.fields.filter((f) => f.tier === "reports");
    if (reportsFields.length && !conn.public.reportsReady) {
      return {
        connectorId: id,
        ok: true,
        message: "App wired — add Reports key for weekly charts in Appable",
      };
    }
    return { connectorId: id, ok: true, message: "Connected" };
  } catch {
    return { connectorId: id, ok: true, message: "Connected" };
  }
}
