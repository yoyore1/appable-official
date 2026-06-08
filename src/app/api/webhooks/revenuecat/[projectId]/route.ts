import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptRevenueCatSecrets } from "@/lib/connectors/revenueCatConnector";
import {
  applyRevenueCatWebhook,
  type RevenueCatWebhookEvent,
} from "@/lib/connectors/webhookSync";
import { verifyConnectorWebhookAuth } from "@/lib/connectors/webhookUrls";

export async function POST(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  const project = await db.getProject(params.projectId);
  const connector = project?.revenueCatConnector;
  if (!connector || connector.public.status !== "connected") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { webhookSecret } = decryptRevenueCatSecrets(connector);
  if (!verifyConnectorWebhookAuth(req, webhookSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { event?: RevenueCatWebhookEvent };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const event = body.event;
  if (!event) {
    return NextResponse.json({ error: "missing_event" }, { status: 400 });
  }

  const result = await applyRevenueCatWebhook(project!, event);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 500 });
  }

  if (!connector.public.webhooksConfigured) {
    await db.updateProject(params.projectId, {
      revenueCatConnector: {
        ...connector,
        public: { ...connector.public, webhooksConfigured: true },
      },
    });
  }

  return NextResponse.json({ ok: true });
}
