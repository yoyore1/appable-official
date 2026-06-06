import { redirect } from "next/navigation";

/**
 * Stripe success landing. In production Stripe fulfillment happens in the
 * webhook (src/app/api/stripe/webhook/route.ts) — the single source of truth —
 * so here we just forward the user to where they were with a celebration flag.
 * (For local real-mode testing, run `stripe listen --forward-to /api/stripe/webhook`.)
 */
export default function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { r?: string };
}) {
  redirect(`${searchParams.r ?? "/dashboard"}?celebrate=1`);
}
