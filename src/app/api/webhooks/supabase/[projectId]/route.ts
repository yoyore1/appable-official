import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptSupabaseConnectorSecrets } from "@/lib/connectors/supabaseConnector";
import { applySupabaseProfileWebhook } from "@/lib/connectors/webhookSync";
import { verifyConnectorWebhookAuth } from "@/lib/connectors/webhookUrls";

type SupabaseDbWebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: { user_id?: string; display_name?: string | null };
};

export async function POST(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  const project = await db.getProject(params.projectId);
  const connector = project?.supabaseConnector;
  if (!connector || connector.public.status !== "connected") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { webhookSecret } = decryptSupabaseConnectorSecrets(connector);
  if (!webhookSecret || !verifyConnectorWebhookAuth(req, webhookSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: SupabaseDbWebhookPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (body.type === "INSERT" && body.table === "appable_profiles" && body.record) {
    const result = await applySupabaseProfileWebhook(project!, body.record);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
