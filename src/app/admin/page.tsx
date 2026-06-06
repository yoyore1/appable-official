import { redirect } from "next/navigation";
import { Users, CreditCard, GraduationCap, Boxes, Rocket, Database } from "lucide-react";
import { Background } from "@/components/Background";
import { AppNav } from "@/components/AppNav";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { courseTiers, prices } from "@/lib/config";
import { formatMoney } from "@/lib/utils";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/dashboard");

  const [stats, cache] = await Promise.all([db.platformStats(), db.cacheStats()]);

  const metrics = [
    { icon: Users, label: "Signups", value: stats.users },
    { icon: CreditCard, label: "Deposits paid", value: stats.depositsPaid },
    { icon: GraduationCap, label: "Course subs", value: stats.courseSubs },
    { icon: Boxes, label: "Projects", value: stats.projects },
    { icon: Rocket, label: "Live apps", value: stats.liveApps },
    { icon: Database, label: "Cached builds", value: cache.total },
  ];

  return (
    <>
      <Background calm />
      <AppNav user={user} />
      <main className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="mt-1 text-charcoal-soft">Platform overview (founder only).</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {metrics.map((m) => (
            <div key={m.label} className="card p-5">
              <m.icon className="h-5 w-5 text-coral" />
              <p className="mt-3 font-display text-3xl font-bold">{m.value}</p>
              <p className="text-sm text-charcoal-soft">{m.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <h2 className="font-semibold">Cache stats</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-charcoal-soft">
              <li>Total cached builds: <strong className="text-charcoal">{cache.total}</strong></li>
              <li>Shared (opt-in): <strong className="text-charcoal">{cache.shared}</strong></li>
              <li>Est. savings: <strong className="text-charcoal">{formatMoney(Math.round(cache.estimatedSavingsUsd * 100))}</strong></li>
            </ul>
          </div>
          <div className="card p-5">
            <h2 className="font-semibold">Pricing config</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-charcoal-soft">
              {prices.packs.map((p) => (
                <li key={p.id}>{p.label}: {formatMoney(p.amount)} → {p.power} power</li>
              ))}
              <li>Launch pack: {formatMoney(prices.launchPack.amount)}</li>
              {courseTiers.map((t) => (
                <li key={t.id}>{t.name} course: {formatMoney(t.amount)}/mo</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-warmgrey">
              Edit values in <code>src/lib/config.ts</code> or env vars. Full admin
              management (clippers, affiliates, editable config) ships with the
              Growth module (Prompt 3).
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
