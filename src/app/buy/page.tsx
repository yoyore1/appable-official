import { redirect } from "next/navigation";
import { Zap, Check, RotateCcw } from "lucide-react";
import { Background } from "@/components/Background";
import { AppNav } from "@/components/AppNav";
import { BuildPowerBar } from "@/components/BuildPowerBar";
import { Confetti } from "@/components/Confetti";
import { getCurrentUser } from "@/lib/session";
import { packCheckout, reviewTopupCheckout } from "@/server/checkout";
import { prices } from "@/lib/config";
import { cn, formatMoney, formatNumber } from "@/lib/utils";

export default async function BuyPage({
  searchParams,
}: {
  searchParams: { celebrate?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <Background calm />
      <AppNav user={user} />
      {searchParams.celebrate && <Confetti />}

      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="reveal reveal-1">
            <h1 className="text-3xl font-bold">Build power</h1>
            <p className="mt-1 text-charcoal-soft">
              Power runs your builds. Top up any time — it never expires.
            </p>
          </div>
          <div className="card p-5 reveal reveal-2">
            <BuildPowerBar power={user.buildPower} compact />
            <p className="mt-2 text-sm text-charcoal-soft">
              You have <strong>{formatNumber(user.buildPower)}</strong> build power.
            </p>
          </div>
        </div>

        {/* Packs */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {prices.packs.map((pack, i) => {
            const action = packCheckout.bind(null, pack.id);
            return (
              <div
                key={pack.id}
                className={cn(
                  "card relative flex flex-col p-6 reveal",
                  i === 0 && "reveal-1",
                  i === 1 && "reveal-2",
                  i === 2 && "reveal-3",
                  "popular" in pack && pack.popular && "ring-2 ring-coral"
                )}
              >
                {"popular" in pack && pack.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-coral px-3 py-1 text-xs font-medium text-white shadow-soft">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-semibold">{pack.label}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-bold">{formatMoney(pack.amount)}</span>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-coral">
                  <Zap className="h-4 w-4" />
                  <span className="font-semibold">{formatNumber(pack.power)}</span> build power
                </p>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm text-charcoal-soft">
                  <li className="flex gap-2"><Check className="h-4 w-4 text-moss" /> Full app builds</li>
                  <li className="flex gap-2"><Check className="h-4 w-4 text-moss" /> Error-fixing rounds</li>
                  <li className="flex gap-2"><Check className="h-4 w-4 text-moss" /> Never expires</li>
                </ul>
                <form action={action} className="mt-5">
                  <button className="btn-primary w-full">Buy {pack.label}</button>
                </form>
              </div>
            );
          })}
        </div>

        {/* Review top-up */}
        <div className="mt-6 card flex flex-col items-start justify-between gap-3 p-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sand text-coral">
              <RotateCcw className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Review top-up</p>
              <p className="text-sm text-charcoal-soft">
                Add {formatNumber(prices.reviewTopup.review)} review power for small fixes &amp; checks.
              </p>
            </div>
          </div>
          <form action={reviewTopupCheckout}>
            <button className="btn-secondary whitespace-nowrap">
              Add for {formatMoney(prices.reviewTopup.amount)}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
