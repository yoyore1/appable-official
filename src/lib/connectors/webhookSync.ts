import { createClient } from "@supabase/supabase-js";
import type { Project } from "@/lib/types";
import { decryptSupabaseConnectorSecrets } from "./supabaseConnector";
import { decryptRevenueCatSecrets } from "./revenueCatConnector";
import { revenueCatEnsureSubscriber } from "./revenueCatManagement";

export interface RevenueCatWebhookEvent {
  type?: string;
  app_user_id?: string;
  product_id?: string;
  entitlement_ids?: string[];
  store?: string;
  expiration_at_ms?: number | null;
}

function supabaseAdmin(project: Project) {
  const connector = project.supabaseConnector;
  if (!connector || connector.public.status !== "connected") return null;
  const { serviceRoleKey } = decryptSupabaseConnectorSecrets(connector);
  return createClient(connector.public.url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const ACTIVE_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_EXTENDED",
]);

const INACTIVE_EVENTS = new Set([
  "CANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
]);

export async function applyRevenueCatWebhook(
  project: Project,
  event: RevenueCatWebhookEvent
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const admin = supabaseAdmin(project);
  if (!admin) {
    return { ok: false, reason: "supabase_not_connected" };
  }

  const appUserId = event.app_user_id?.trim();
  if (!appUserId) return { ok: false, reason: "missing_app_user_id" };

  const type = event.type ?? "";
  let isActive = ACTIVE_EVENTS.has(type);
  if (INACTIVE_EVENTS.has(type)) isActive = false;
  if (!type) isActive = Boolean(event.entitlement_ids?.length);

  const expiresAt =
    event.expiration_at_ms != null && event.expiration_at_ms > 0
      ? new Date(event.expiration_at_ms).toISOString()
      : null;

  const { error } = await admin.from("appable_subscriptions").upsert({
    user_id: appUserId,
    revenuecat_app_user_id: appUserId,
    entitlement_ids: event.entitlement_ids ?? [],
    is_active: isActive,
    product_id: event.product_id ?? null,
    store: event.store ?? null,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return { ok: false, reason: error.message };
  }
  return { ok: true };
}

export async function applySupabaseProfileWebhook(
  project: Project,
  record: { user_id?: string; display_name?: string | null }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const userId = record.user_id?.trim();
  if (!userId) return { ok: false, reason: "missing_user_id" };

  const rc = project.revenueCatConnector;
  if (!rc || rc.public.status !== "connected") {
    return { ok: true };
  }

  try {
    const { secretApiKey } = decryptRevenueCatSecrets(rc);
    await revenueCatEnsureSubscriber(secretApiKey, userId);
  } catch {
    return { ok: false, reason: "revenuecat_sync_failed" };
  }

  return { ok: true };
}
