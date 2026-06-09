import type { ConnectorId } from "./catalog";
import { getConnectorDefinition } from "./registry";
import {
  appTierFields,
  getSdkSpec,
  reportsTierFields,
  type SdkFieldSpec,
} from "./sdkCatalog";

export const REPORTS_KEYS_INTRO =
  "Reports keys stay in Appable only — weekly charts and AI summaries in Reports. " +
  "They are never shipped in your exported app.";

export const APP_KEYS_INTRO =
  "App keys go in your exported build so the SDK can run in production.";

/** Plain-text block for Explain / coach — embedded credential guidance. */
export function integrationCredentialGuide(id: ConnectorId): string {
  const def = getConnectorDefinition(id);
  try {
    const spec = getSdkSpec(id);
    const app = appTierFields(spec);
    const reports = reportsTierFields(spec);
    const lines = [`${def.displayName} uses two credential types:`];
    if (app.length) {
      lines.push(
        `- App (${APP_KEYS_INTRO}): ${app.map((f) => f.label).join(", ")}.`
      );
    }
    if (reports.length) {
      lines.push(`- Reports (${REPORTS_KEYS_INTRO})`);
      for (const f of reports) {
        lines.push(`  · ${f.label}${f.why ? ` — ${f.why}` : ""}`);
      }
    } else if (app.length) {
      lines.push(
        `- Reports: same API token also powers weekly insights in Appable when connected.`
      );
    }
    return lines.join("\n");
  } catch {
    if (id === "revenuecat") {
      return (
        `${def.displayName}: Public key → app SDK. Secret key → webhooks + Revenue charts in Appable Reports (never in the client app).`
      );
    }
    if (id === "supabase") {
      return (
        `${def.displayName}: Access token links your project; Appable can read user counts for Reports from your database.`
      );
    }
    return `${def.displayName}: paste keys in Integrations — encrypted at rest.`;
  }
}

export function fieldTierLabel(field: SdkFieldSpec): string {
  return field.tier === "reports" ? "Reports" : "App";
}
