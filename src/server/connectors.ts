"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  linkSupabaseProject,
  probeSupabaseProjects,
} from "@/lib/connectors/supabaseConnector";
import { linkRevenueCatProject } from "@/lib/connectors/revenueCatConnector";
import { linkRailwayProject } from "@/lib/connectors/railwayConnector";
import { APPABLE_SUPABASE_SETUP_SQL, runSupabaseSetupSql } from "@/lib/connectors/supabaseManagement";
import { resolveProjectAccess } from "@/lib/projectAccess";
import type {
  ProjectRevenueCatConnector,
  ProjectSupabaseConnector,
  RailwayConnectorPublic,
  RevenueCatConnectorPublic,
  SupabaseConnectorPublic,
} from "@/lib/types";

export type SupabaseProjectOption = {
  ref: string;
  name: string;
  region?: string;
};

export async function listSupabaseProjectsForConnect(
  projectId: string,
  accessToken: string
): Promise<
  | { ok: true; projects: SupabaseProjectOption[] }
  | { ok: false; error: "not_found" | "invalid_token" | "failed"; message: string }
> {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) return { ok: false, error: "not_found", message: "Project not found." };

  const token = accessToken.trim();
  if (token.length < 8) {
    return { ok: false, error: "invalid_token", message: "Enter a valid access token." };
  }

  try {
    const projects = await probeSupabaseProjects(token);
    return {
      ok: true,
      projects: projects.map((p) => ({
        ref: p.ref,
        name: p.name,
        region: p.region,
      })),
    };
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_TOKEN") {
      return {
        ok: false,
        error: "invalid_token",
        message: "That token didn’t work — create a new one in Supabase Account Settings.",
      };
    }
    return {
      ok: false,
      error: "failed",
      message: err instanceof Error ? err.message : "Could not list projects.",
    };
  }
}

export async function connectSupabaseToProject(
  projectId: string,
  accessToken: string,
  projectRef: string,
  projectName: string,
  region?: string
): Promise<
  | { ok: true; connector: SupabaseConnectorPublic }
  | { ok: false; error: string; message: string }
> {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) return { ok: false, error: "not_found", message: "Project not found." };

  const token = accessToken.trim();
  if (!token || !projectRef.trim()) {
    return { ok: false, error: "invalid", message: "Missing token or project." };
  }

  try {
    const connector = await linkSupabaseProject({
      accessToken: token,
      projectRef: projectRef.trim(),
      projectName: projectName.trim() || projectRef,
      projectId,
      region: region ?? null,
      runSetup: true,
    });

    await db.updateProject(projectId, { supabaseConnector: connector });
    revalidatePath(`/project/${projectId}/expo`);

    return { ok: true, connector: connector.public };
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_TOKEN") {
      return {
        ok: false,
        error: "invalid_token",
        message: "Access token expired or invalid.",
      };
    }
    return {
      ok: false,
      error: "failed",
      message: err instanceof Error ? err.message : "Could not connect Supabase.",
    };
  }
}

export async function retrySupabaseSetup(
  projectId: string,
  accessToken: string
): Promise<
  | { ok: true; connector: SupabaseConnectorPublic }
  | { ok: false; message: string }
> {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) return { ok: false, message: "Project not found." };

  const existing = access.project.supabaseConnector;
  if (!existing) return { ok: false, message: "No Supabase connection." };

  const token = accessToken.trim();
  if (!token) return { ok: false, message: "Access token required to retry setup." };

  try {
    await runSupabaseSetupSql(
      token,
      existing.public.projectRef,
      APPABLE_SUPABASE_SETUP_SQL
    );
    const next: ProjectSupabaseConnector = {
      ...existing,
      public: {
        ...existing.public,
        status: "connected",
        schemaVersion: 1,
        setupError: null,
      },
    };
    await db.updateProject(projectId, { supabaseConnector: next });
    revalidatePath(`/project/${projectId}/expo`);
    return { ok: true, connector: next.public };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Setup failed again.",
    };
  }
}

export async function disconnectSupabaseFromProject(
  projectId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) return { ok: false, message: "Project not found." };

  await db.updateProject(projectId, { supabaseConnector: null });
  revalidatePath(`/project/${projectId}/expo`);
  return { ok: true };
}

export async function applyMessagingSchemaToProject(
  projectId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) return { ok: false, message: "Project not found." };
  const connector = access.project.supabaseConnector;
  if (!connector || connector.public.status === "disconnected") {
    return { ok: false, message: "Connect Supabase in Connections first." };
  }
  const { runMessagingSchemaSetup } = await import("@/lib/connectors/supabaseConnector");
  const result = await runMessagingSchemaSetup(connector);
  if (result.ok) {
    const next = {
      ...connector,
      public: { ...connector.public, schemaVersion: Math.max(connector.public.schemaVersion, 2) },
    };
    await db.updateProject(projectId, { supabaseConnector: next });
    revalidatePath(`/project/${projectId}/expo`);
  }
  return result;
}

export async function getSupabaseConnectorStatus(
  projectId: string
): Promise<SupabaseConnectorPublic | null> {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) return null;
  return access.project.supabaseConnector?.public ?? null;
}

/** @internal — avoid exporting secrets to client components. */
export async function getSupabaseConnectorForService(projectId: string) {
  const project = await db.getProject(projectId);
  if (!project?.supabaseConnector) return null;
  const { supabaseConnectorForBuilder } = await import(
    "@/lib/connectors/supabaseConnector"
  );
  return supabaseConnectorForBuilder(project.supabaseConnector);
}

export async function connectRevenueCatToProject(
  projectId: string,
  publicApiKey: string,
  secretApiKey: string
): Promise<
  | { ok: true; connector: RevenueCatConnectorPublic }
  | { ok: false; error: string; message: string }
> {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) return { ok: false, error: "not_found", message: "Project not found." };

  try {
    const connector = await linkRevenueCatProject({
      projectId,
      publicApiKey,
      secretApiKey,
    });

    await db.updateProject(projectId, { revenueCatConnector: connector });
    revalidatePath(`/project/${projectId}/expo`);
    return { ok: true, connector: connector.public };
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_SECRET_KEY") {
      return {
        ok: false,
        error: "invalid_key",
        message: "Secret API key didn’t work — copy it from RevenueCat → API keys.",
      };
    }
    if (err instanceof Error && err.message === "INVALID_KEYS") {
      return { ok: false, error: "invalid", message: "Enter both API keys." };
    }
    return {
      ok: false,
      error: "failed",
      message: err instanceof Error ? err.message : "Could not connect RevenueCat.",
    };
  }
}

export async function disconnectRevenueCatFromProject(
  projectId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) return { ok: false, message: "Project not found." };
  await db.updateProject(projectId, { revenueCatConnector: null });
  revalidatePath(`/project/${projectId}/expo`);
  return { ok: true };
}

export async function connectRailwayToProject(
  projectId: string,
  apiToken: string,
  serviceUrl: string
): Promise<
  | { ok: true; connector: RailwayConnectorPublic }
  | { ok: false; error: string; message: string }
> {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) return { ok: false, error: "not_found", message: "Project not found." };

  try {
    const connector = await linkRailwayProject({ apiToken, serviceUrl });
    await db.updateProject(projectId, { railwayConnector: connector });
    revalidatePath(`/project/${projectId}/expo`);
    return { ok: true, connector: connector.public };
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_TOKEN") {
      return {
        ok: false,
        error: "invalid_token",
        message: "That Railway token didn't work — create a new one at railway.com/account/tokens.",
      };
    }
    if (err instanceof Error && err.message === "INVALID_URL") {
      return {
        ok: false,
        error: "invalid_url",
        message: "Enter a valid https:// URL for your deployed Railway service.",
      };
    }
    return {
      ok: false,
      error: "failed",
      message: err instanceof Error ? err.message : "Could not connect Railway.",
    };
  }
}

export async function disconnectRailwayFromProject(
  projectId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) return { ok: false, message: "Project not found." };
  await db.updateProject(projectId, { railwayConnector: null });
  revalidatePath(`/project/${projectId}/expo`);
  return { ok: true };
}

export async function markRevenueCatWebhooksConfigured(
  projectId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) return { ok: false, message: "Project not found." };
  const existing = access.project.revenueCatConnector;
  if (!existing) return { ok: false, message: "RevenueCat not connected." };
  const next: ProjectRevenueCatConnector = {
    ...existing,
    public: { ...existing.public, webhooksConfigured: true },
  };
  await db.updateProject(projectId, { revenueCatConnector: next });
  revalidatePath(`/project/${projectId}/expo`);
  return { ok: true };
}

export async function getConnectorWebhookSecrets(projectId: string): Promise<
  | {
      ok: true;
      revenueCat?: { webhookUrl: string; authorization: string };
      supabase?: { webhookUrl: string; secret: string };
    }
  | { ok: false; message: string }
> {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) return { ok: false, message: "Project not found." };

  const out: {
    revenueCat?: { webhookUrl: string; authorization: string };
    supabase?: { webhookUrl: string; secret: string };
  } = {};

  const rc = access.project.revenueCatConnector;
  if (rc?.public.status === "connected") {
    const { decryptRevenueCatSecrets } = await import(
      "@/lib/connectors/revenueCatConnector"
    );
    const secrets = decryptRevenueCatSecrets(rc);
    out.revenueCat = {
      webhookUrl: rc.public.webhookUrl,
      authorization: `Bearer ${secrets.webhookSecret}`,
    };
  }

  let sb = access.project.supabaseConnector;
  if (sb?.public.status === "connected") {
    if (!sb.webhookSecretEnc || !sb.public.webhookUrl) {
      const { encryptConnectorSecret } = await import("@/lib/connectors/encrypt");
      const { mintWebhookSecret, supabaseWebhookUrl } = await import(
        "@/lib/connectors/webhookUrls"
      );
      const patched = {
        ...sb,
        public: {
          ...sb.public,
          webhookUrl: sb.public.webhookUrl ?? supabaseWebhookUrl(projectId),
        },
        webhookSecretEnc:
          sb.webhookSecretEnc ?? encryptConnectorSecret(mintWebhookSecret()),
      };
      await db.updateProject(projectId, { supabaseConnector: patched });
      sb = patched;
    }
    const { decryptConnectorSecret } = await import("@/lib/connectors/encrypt");
    out.supabase = {
      webhookUrl: sb.public.webhookUrl ?? "",
      secret: decryptConnectorSecret(sb.webhookSecretEnc!),
    };
  }

  return { ok: true, ...out };
}
