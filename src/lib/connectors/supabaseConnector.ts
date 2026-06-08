import type {
  ProjectSupabaseConnector,
  SupabaseConnectorPublic,
} from "@/lib/types";
import { encryptConnectorSecret, decryptConnectorSecret } from "./encrypt";
import {
  APPABLE_SUPABASE_SETUP_SQL,
  fetchSupabaseApiKeys,
  listSupabaseProjects,
  runSupabaseSetupSql,
  type SupabaseManagementProject,
} from "./supabaseManagement";
import { mintWebhookSecret, supabaseWebhookUrl } from "./webhookUrls";

export type { SupabaseManagementProject };

export function supabaseConnectorPublic(
  connector: ProjectSupabaseConnector | null | undefined
): SupabaseConnectorPublic | null {
  return connector?.public ?? null;
}

export function decryptSupabaseConnectorSecrets(connector: ProjectSupabaseConnector): {
  anonKey: string;
  serviceRoleKey: string;
  webhookSecret: string | null;
} {
  return {
    anonKey: decryptConnectorSecret(connector.anonKeyEnc),
    serviceRoleKey: decryptConnectorSecret(connector.serviceRoleKeyEnc),
    webhookSecret: connector.webhookSecretEnc
      ? decryptConnectorSecret(connector.webhookSecretEnc)
      : null,
  };
}

export async function probeSupabaseProjects(
  accessToken: string
): Promise<SupabaseManagementProject[]> {
  const projects = await listSupabaseProjects(accessToken);
  return projects.sort((a, b) => a.name.localeCompare(b.name));
}

export async function linkSupabaseProject(input: {
  accessToken: string;
  projectRef: string;
  projectName: string;
  projectId: string;
  region?: string | null;
  runSetup: boolean;
}): Promise<ProjectSupabaseConnector> {
  const keys = await fetchSupabaseApiKeys(input.accessToken, input.projectRef);

  let setupError: string | null = null;
  let status: SupabaseConnectorPublic["status"] = "connected";
  let schemaVersion = 0;

  if (input.runSetup) {
    try {
      await runSupabaseSetupSql(
        input.accessToken,
        input.projectRef,
        APPABLE_SUPABASE_SETUP_SQL
      );
      schemaVersion = 1;
    } catch (err) {
      status = "setup_failed";
      setupError =
        err instanceof Error ? err.message.slice(0, 240) : "Database setup failed";
    }
  }

  const webhookSecret = mintWebhookSecret();

  return {
    public: {
      projectRef: input.projectRef,
      projectName: input.projectName,
      url: keys.url,
      region: input.region ?? null,
      status,
      connectedAt: new Date().toISOString(),
      schemaVersion,
      setupError,
      webhookUrl: supabaseWebhookUrl(input.projectId),
    },
    anonKeyEnc: encryptConnectorSecret(keys.anonKey),
    serviceRoleKeyEnc: encryptConnectorSecret(keys.serviceRoleKey),
    webhookSecretEnc: encryptConnectorSecret(webhookSecret),
  };
}

/** Builder / service API — includes decrypted keys. */
export function supabaseConnectorForBuilder(
  connector: ProjectSupabaseConnector | null | undefined
) {
  if (!connector || connector.public.status === "disconnected") return null;
  const secrets = decryptSupabaseConnectorSecrets(connector);
  return {
    projectRef: connector.public.projectRef,
    projectName: connector.public.projectName,
    url: connector.public.url,
    region: connector.public.region,
    status: connector.public.status,
    schemaVersion: connector.public.schemaVersion,
    setupError: connector.public.setupError,
    anonKey: secrets.anonKey,
    serviceRoleKey: secrets.serviceRoleKey,
    profilesTable: "appable_profiles",
    onboardingFlagColumn: "has_completed_onboarding",
  };
}

export function formatSupabaseConnectorForCoach(
  connector: ProjectSupabaseConnector | null | undefined
): string {
  const pub = supabaseConnectorPublic(connector);
  if (!pub) {
    return "Supabase: not connected — user should use Connect Supabase on the checklist (not Build mode) for real database/auth.";
  }
  const lines = [
    `Supabase: ${pub.status} · project "${pub.projectName}" (${pub.projectRef})`,
    `URL: ${pub.url}`,
    `Schema v${pub.schemaVersion} (appable_profiles + has_completed_onboarding when setup succeeded)`,
  ];
  if (pub.setupError) lines.push(`Setup note: ${pub.setupError}`);
  if (pub.status === "connected") {
    lines.push(
      "Full build in Appable Builder can wire sign-up using these keys — do not ask user to paste API keys."
    );
  }
  return lines.join("\n");
}
