import { redirect } from "next/navigation";
import { Check, ShieldCheck } from "lucide-react";
import { Background } from "@/components/Background";
import { Logo } from "@/components/Logo";
import { getCurrentUser } from "@/lib/session";
import { depositCheckout } from "@/server/checkout";
import { prices } from "@/lib/config";
import { formatMoney } from "@/lib/utils";

export default async function DepositPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signup");
  if (user.depositPaid) redirect("/dashboard");

  return (
    <>
      <Background />
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card-float p-7 reveal reveal-1">
          <span className="label">One last thing</span>
          <h1 className="mt-1 text-2xl font-bold">
            {formatMoney(prices.deposit.amount)} to get started — that&apos;s it.
          </h1>
          <p className="mt-2 text-charcoal-soft">
            It goes straight toward your first build as{" "}
            <strong className="text-charcoal">build power</strong>. No subscription, no surprises.
          </p>

          <ul className="mt-5 space-y-2 text-sm">
            {[
              "Unlocks your dashboard and the build chat",
              `Becomes ${prices.deposit.power} build power instantly`,
              "Build your first app UI for free",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2 text-charcoal-soft">
                <Check className="h-4 w-4 text-moss" /> {t}
              </li>
            ))}
          </ul>

          <form action={depositCheckout} className="mt-6">
            <button className="btn-primary w-full">
              Pay {formatMoney(prices.deposit.amount)} &amp; start building
            </button>
          </form>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-warmgrey">
            <ShieldCheck className="h-3.5 w-3.5" />
            Deposit becomes a non-refundable build credit once a build is used.
          </p>
        </div>
      </main>
    </>
  );
}
