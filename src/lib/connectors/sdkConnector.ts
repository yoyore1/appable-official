import type { ConnectorId } from "./catalog";
import type { ProjectSdkConnector, SdkConnectorPublic } from "@/lib/types";
import {
  ConnectorDecryptError,
  encryptConnectorSecret,
  decryptConnectorSecret,
  tryDecryptConnectorSecret,
} from "./encrypt";
import {
  appTierFields,
  getSdkSpec,
  sdkReportsReady,
  validateSdkValues,
  type SdkConnectorSpec,
} from "./sdkCatalog";

function maskValue(value: string): string {
  const v = value.trim();
  if (v.length <= 8) return "••••";
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

export function linkSdkConnector(
  connectorId: ConnectorId,
  values: Record<string, string>
): ProjectSdkConnector {
  const spec = getSdkSpec(connectorId);
  const err = validateSdkValues(spec, values);
  if (err) throw new Error(err);

  const hints: Record<string, string> = {};
  const secretsEnc: Record<string, string> = {};

  for (const field of spec.fields) {
    const v = (values[field.id] ?? "").trim();
    if (!v) continue;
    hints[field.id] = field.secret ? maskValue(v) : v.length > 24 ? `${v.slice(0, 12)}…` : v;
    if (field.secret) {
      secretsEnc[field.id] = encryptConnectorSecret(v);
    } else {
      secretsEnc[field.id] = encryptConnectorSecret(v);
    }
  }

  return {
    public: {
      status: "connected",
      connectedAt: new Date().toISOString(),
      hints,
      reportsReady: sdkReportsReady(spec, values),
    },
    secretsEnc,
  };
}

export function sdkConnectorPublic(
  connector: ProjectSdkConnector | null | undefined
): SdkConnectorPublic | null {
  if (!connector || connector.public.status === "disconnected") return null;
  return connector.public;
}

export function decryptSdkSecrets(connector: ProjectSdkConnector): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, enc] of Object.entries(connector.secretsEnc)) {
    const plain = tryDecryptConnectorSecret(enc);
    if (plain === null) {
      throw new ConnectorDecryptError();
    }
    out[key] = plain;
  }
  return out;
}

export function sdkConnectorsForBuilder(
  connectors: Partial<Record<string, ProjectSdkConnector>> | null | undefined
): Record<string, Record<string, string>> {
  if (!connectors) return {};
  const out: Record<string, Record<string, string>> = {};
  for (const [id, conn] of Object.entries(connectors)) {
    if (!conn || conn.public.status !== "connected") continue;
    const spec = getSdkSpec(id as ConnectorId);
    const allowed = new Set(appTierFields(spec).map((f) => f.id));
    const secrets = decryptSdkSecrets(conn);
    const appOnly: Record<string, string> = {};
    for (const [key, val] of Object.entries(secrets)) {
      if (allowed.has(key)) appOnly[key] = val;
    }
    out[id] = appOnly;
  }
  return out;
}

function reportFieldIds(spec: SdkConnectorSpec): string[] {
  const reports = spec.fields.filter((f) => f.tier === "reports");
  if (reports.length) return reports.map((f) => f.id);
  return appTierFields(spec).map((f) => f.id);
}

/** Server-only — secrets for weekly insights pull (never exported to the app). */
export function sdkConnectorsForReports(
  connectors: Partial<Record<string, ProjectSdkConnector>> | null | undefined
): Record<string, Record<string, string>> {
  if (!connectors) return {};
  const out: Record<string, Record<string, string>> = {};
  for (const [id, conn] of Object.entries(connectors)) {
    if (!conn?.public.reportsReady) continue;
    const spec = getSdkSpec(id as ConnectorId);
    const allowed = new Set(reportFieldIds(spec));
    const secrets = decryptSdkSecrets(conn);
    const reports: Record<string, string> = {};
    for (const [key, val] of Object.entries(secrets)) {
      if (allowed.has(key)) reports[key] = val;
    }
    if (Object.keys(reports).length) out[id] = reports;
  }
  return out;
}

export function sdkSpecFor(id: ConnectorId): SdkConnectorSpec {
  return getSdkSpec(id);
}
