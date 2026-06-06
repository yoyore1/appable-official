import { NextRequest, NextResponse } from "next/server";
import { integrations, stripeConfig } from "@/lib/config";
import { decodeKind, fulfill } from "@/lib/payments";

export const runtime = "nodejs";

/**
 * Stripe webhook — the single source of truth for fulfilling real payments.
 * Verifies the signature, then applies build power / launch packs / course
 * subscriptions via the same fulfill() used by mock checkout.
 */
export async function POST(req: NextRequest) {
  if (!integrations.stripe || !stripeConfig.webhookSecret) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 400 });
  }

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(stripeConfig.secretKey!);

  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: import("stripe").Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, stripeConfig.webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `signature_verification_failed: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "invoice.paid"
  ) {
    const session = event.data.object as {
      metadata?: { userId?: string; kind?: string };
      client_reference_id?: string;
    };
    const userId = session.metadata?.userId ?? session.client_reference_id;
    const token = session.metadata?.kind;
    if (userId && token) {
      try {
        await fulfill(userId, decodeKind(token));
      } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
