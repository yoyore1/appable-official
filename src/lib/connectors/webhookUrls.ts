import { appUrl } from "@/lib/config";
import { randomBytes } from "crypto";

export function connectorWebhookBase(): string {
  return appUrl.replace(/\/$/, "");
}

export function revenueCatWebhookUrl(projectId: string): string {
  return `${connectorWebhookBase()}/api/webhooks/revenuecat/${projectId}`;
}

export function supabaseWebhookUrl(projectId: string): string {
  return `${connectorWebhookBase()}/api/webhooks/supabase/${projectId}`;
}

/** Per-project secret — paste as Authorization Bearer in RevenueCat / header in Supabase. */
export function mintWebhookSecret(): string {
  return `appable_wh_${randomBytes(24).toString("hex")}`;
}

export function verifyConnectorWebhookAuth(
  req: Request,
  expectedSecret: string
): boolean {
  const bearer = req.headers.get("authorization")?.trim() ?? "";
  if (bearer === `Bearer ${expectedSecret}`) return true;
  const header = req.headers.get("x-appable-webhook-secret")?.trim();
  return header === expectedSecret;
}
