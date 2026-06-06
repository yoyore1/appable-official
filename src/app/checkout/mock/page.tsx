import { redirect } from "next/navigation";
import { CreditCard, Lock } from "lucide-react";
import { Background } from "@/components/Background";
import { Logo } from "@/components/Logo";
import { getCurrentUser } from "@/lib/session";
import { decodeKind, describe } from "@/lib/payments";
import { confirmMockCheckout } from "@/server/checkout";
import { formatMoney } from "@/lib/utils";

/**
 * Mock checkout screen — only used when Stripe keys aren't configured.
 * Mirrors a Stripe Checkout confirmation, then applies the purchase locally.
 */
export default async function MockCheckoutPage({
  searchParams,
}: {
  searchParams: { k?: string; r?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const token = searchParams.k ?? "";
  const returnTo = searchParams.r ?? "/dashboard";
  let meta: { label: string; amount: number; mode: string };
  try {
    meta = describe(decodeKind(token));
  } catch {
    redirect(returnTo);
  }

  return (
    <>
      <Background calm />
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card-float p-7 reveal reveal-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1 text-xs text-warmgrey">
            <Lock className="h-3 w-3" /> Test checkout (no real charge)
          </span>
          <h1 className="mt-3 text-2xl font-bold">{meta.label}</h1>
          <div className="mt-4 flex items-baseline justify-between rounded-2xl bg-sand/60 p-4">
            <span className="text-charcoal-soft">
              {meta.mode === "subscription" ? "Per month" : "Total"}
            </span>
            <span className="font-display text-2xl font-semibold">
              {formatMoney(meta.amount)}
            </span>
          </div>

          <form action={confirmMockCheckout} className="mt-6 space-y-3">
            <input type="hidden" name="k" value={token} />
            <input type="hidden" name="r" value={returnTo} />
            <button className="btn-primary w-full">
              <CreditCard className="h-4 w-4" /> Pay {formatMoney(meta.amount)}
            </button>
            <a href={returnTo} className="btn-ghost w-full">Cancel</a>
          </form>

          <p className="mt-3 text-center text-xs text-warmgrey">
            Add your Stripe keys in <code>.env.local</code> to use real payments.
          </p>
        </div>
      </main>
    </>
  );
}
