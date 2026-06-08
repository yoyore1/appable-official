/**
 * Payments. One small abstraction over Stripe so the whole purchase surface
 * (deposit, build-power packs, review top-up, launch pack + add-ons, course
 * subscriptions) works identically in MOCK MODE and with real Stripe.
 *
 * - startCheckout() returns a URL to send the user to.
 *     • Stripe configured → a real Checkout Session URL.
 *     • Mock mode          → /checkout/mock?... which immediately fulfills.
 * - fulfill() applies what a purchase grants. It's called by BOTH the mock
 *   success route AND the Stripe webhook, so the effect is always identical.
 */
import "server-only";
import { appUrl, courseTiers, integrations, prices, stripeConfig } from "@/lib/config";
import { db } from "@/lib/db";

export type PurchaseKind =
  | { type: "deposit" }
  | { type: "pack"; packId: string }
  | { type: "review_topup" }
  | { type: "launch_pack"; projectId: string }
  | { type: "launch_addon"; addon: "aso" | "screenshots" | "video"; projectId: string }
  | { type: "course"; tierId: string };

export function describe(kind: PurchaseKind): { label: string; amount: number; mode: "payment" | "subscription" } {
  switch (kind.type) {
    case "deposit":
      return { label: prices.deposit.label, amount: prices.deposit.amount, mode: "payment" };
    case "pack": {
      const p = prices.packs.find((x) => x.id === kind.packId);
      if (!p) throw new Error("UNKNOWN_PACK");
      return { label: `${p.label} build power`, amount: p.amount, mode: "payment" };
    }
    case "review_topup":
      return { label: prices.reviewTopup.label, amount: prices.reviewTopup.amount, mode: "payment" };
    case "launch_pack":
      return { label: prices.launchPack.label, amount: prices.launchPack.amount, mode: "payment" };
    case "launch_addon": {
      const a = prices.launchAddons[kind.addon];
      return { label: a.label, amount: a.amount, mode: "payment" };
    }
    case "course": {
      const t = courseTiers.find((x) => x.id === kind.tierId);
      if (!t) throw new Error("UNKNOWN_TIER");
      return { label: `${t.name} course`, amount: t.amount, mode: "subscription" };
    }
  }
}

function encodeKind(kind: PurchaseKind): string {
  return Buffer.from(JSON.stringify(kind)).toString("base64url");
}

export function decodeKind(token: string): PurchaseKind {
  return JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
}

export async function startCheckout(
  userId: string,
  kind: PurchaseKind,
  returnTo = "/dashboard"
): Promise<string> {
  const token = encodeKind(kind);

  if (!integrations.stripe) {
    // Mock checkout: a friendly confirm screen that calls fulfill on continue.
    const params = new URLSearchParams({ k: token, r: returnTo });
    return `/checkout/mock?${params.toString()}`;
  }

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(stripeConfig.secretKey!);
  const meta = describe(kind);
  const session = await stripe.checkout.sessions.create({
    mode: meta.mode,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: meta.amount,
          product_data: { name: `Appable — ${meta.label}` },
          ...(meta.mode === "subscription" ? { recurring: { interval: "month" } } : {}),
        },
      },
    ],
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&r=${encodeURIComponent(returnTo)}`,
    cancel_url: `${appUrl}${returnTo}`,
    client_reference_id: userId,
    metadata: { userId, kind: token },
  });
  return session.url!;
}

/** Apply the effect of a purchase. Idempotent-ish for mock use. */
export async function fulfill(userId: string, kind: PurchaseKind): Promise<void> {
  switch (kind.type) {
    case "deposit": {
      await db.updateUser(userId, { depositPaid: true });
      await db.addBuildPower(userId, prices.deposit.power);
      return;
    }
    case "pack": {
      const p = prices.packs.find((x) => x.id === kind.packId);
      if (p) {
        await db.addBuildPower(userId, p.power);
        await db.updateUser(userId, { usagePackPurchased: true });
      }
      return;
    }
    case "review_topup": {
      await db.addReviewBalance(userId, prices.reviewTopup.review);
      return;
    }
    case "launch_pack": {
      const project = await db.getProject(kind.projectId);
      if (project) {
        await db.updateProject(project.id, {
          launch: { ...project.launch, purchased: true },
        });
      }
      return;
    }
    case "launch_addon": {
      // The actual asset generation is triggered from the project view after
      // purchase; here we just mark the pack as owned so add-ons unlock.
      const project = await db.getProject(kind.projectId);
      if (project) {
        await db.updateProject(project.id, {
          launch: { ...project.launch, purchased: true },
        });
      }
      return;
    }
    case "course": {
      const t = courseTiers.find((x) => x.id === kind.tierId);
      if (t) {
        await db.updateUser(userId, { courseTierId: t.id });
        await db.addBuildPower(userId, t.monthlyPower);
      }
      return;
    }
  }
}
