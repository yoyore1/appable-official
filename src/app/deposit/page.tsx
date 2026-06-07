import { redirect } from "next/navigation";
import { CreditCard, Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { Background } from "@/components/Background";
import { Logo } from "@/components/Logo";
import { PhonePreview } from "@/components/PhonePreview";
import { getCurrentUser } from "@/lib/session";
import { depositCheckout } from "@/server/checkout";
import { db } from "@/lib/db";
import { prices } from "@/lib/config";
import { formatMoney } from "@/lib/utils";

export default async function DepositPage({
  searchParams,
}: {
  searchParams: { project?: string };
}) {
  const user = await getCurrentUser();
  const projectId = searchParams.project?.trim();
  if (!user) {
    redirect(projectId ? `/signup?project=${projectId}` : "/signup");
  }

  if (user.depositPaid) {
    redirect(projectId ? `/project/${projectId}?celebrate=1` : "/dashboard");
  }

  const project = projectId ? await db.getProject(projectId) : undefined;
  const mp = project?.masterPrompt;
  const returnTo = projectId
    ? `/project/${projectId}?celebrate=1`
    : "/dashboard";

  return (
    <>
      <Background calm />
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        {mp && (
          <div className="mb-5 flex items-center gap-4 rounded-2xl border border-line/50 bg-white/70 p-4 shadow-soft reveal reveal-1">
            <PhonePreview
              hue={8 + (project?.thumbnailHue ?? 0)}
              label={mp.appName}
              status={mp.vibe}
              className="w-[88px] shrink-0"
            />
            <div className="min-w-0">
              <p className="label">Your app</p>
              <p className="truncate font-semibold">{mp.appName}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-charcoal-soft">
                {mp.description}
              </p>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-line/60 bg-white shadow-[0_12px_40px_-12px_rgba(43,38,36,0.18)] reveal reveal-2">
          <div className="border-b border-line/50 bg-sand/40 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-warmgrey">
                  Returnable deposit
                </p>
                <p className="mt-0.5 font-display text-2xl font-bold">
                  {formatMoney(prices.deposit.amount)}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-moss/10 px-2.5 py-1 text-xs font-medium text-moss">
                <RotateCcw className="h-3 w-3" />
                Refundable
              </span>
            </div>
            <p className="mt-2 text-sm text-charcoal-soft">
              A {formatMoney(prices.deposit.amount)} returnable deposit — refunded
              automatically when you subscribe.
            </p>
          </div>

          <form action={depositCheckout} className="space-y-4 p-6">
            <input type="hidden" name="returnTo" value={returnTo} />

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-charcoal-soft">
                  Card number
                </span>
                <div className="relative">
                  <input
                    disabled
                    placeholder="4242 4242 4242 4242"
                    className="input w-full pr-10 opacity-80"
                    autoComplete="cc-number"
                  />
                  <CreditCard className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warmgrey" />
                </div>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-charcoal-soft">
                    Expiry
                  </span>
                  <input
                    disabled
                    placeholder="MM / YY"
                    className="input w-full opacity-80"
                    autoComplete="cc-exp"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-charcoal-soft">
                    CVC
                  </span>
                  <input
                    disabled
                    placeholder="123"
                    className="input w-full opacity-80"
                    autoComplete="cc-csc"
                  />
                </label>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full !rounded-xl">
              Pay {formatMoney(prices.deposit.amount)} &amp; continue
            </button>

            <p className="flex items-center justify-center gap-1.5 text-xs text-warmgrey">
              <Lock className="h-3.5 w-3.5" />
              Secure checkout · Stripe integration coming next
            </p>
          </form>
        </div>

        <ul className="mt-5 space-y-2 text-sm text-charcoal-soft reveal reveal-3">
          {[
            "Unlocks your dashboard and build tools",
            `Becomes ${prices.deposit.power} build power instantly`,
            "Fully refunded when you subscribe — no catch",
          ].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-moss" />
              {t}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
