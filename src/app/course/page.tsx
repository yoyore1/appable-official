import Link from "next/link";
import { Check, Lock, PlayCircle, CalendarDays } from "lucide-react";
import { Background } from "@/components/Background";
import { AppNav } from "@/components/AppNav";
import { MarketingNav } from "@/components/MarketingNav";
import { Confetti } from "@/components/Confetti";
import { getCurrentUser } from "@/lib/session";
import { courseCheckout } from "@/server/checkout";
import { courseTiers } from "@/lib/config";
import { cn, formatMoney, formatNumber } from "@/lib/utils";

const lessons = [
  { title: "From idea to app — the mindset", free: true },
  { title: "Writing a great app interview", free: true },
  { title: "Designing screens people love", free: false },
  { title: "Wiring up logins & saving data", free: false },
  { title: "Payments & paywalls that convert", free: false },
  { title: "Launching on the App Store", free: false },
];

export default async function CoursePage({
  searchParams,
}: {
  searchParams: { celebrate?: string };
}) {
  const user = await getCurrentUser();
  const tier = user?.courseTierId
    ? courseTiers.find((t) => t.id === user.courseTierId)
    : null;
  const subscribed = Boolean(tier);

  return (
    <>
      <Background calm />
      {user ? <AppNav user={user} /> : <MarketingNav user={user} />}
      {searchParams.celebrate && <Confetti />}

      <main className="mx-auto max-w-5xl px-5 py-10">
        <div className="text-center reveal reveal-1">
          <h1 className="text-4xl font-bold">The Appable course</h1>
          <p className="mx-auto mt-2 max-w-xl text-charcoal-soft">
            Go from first-timer to app founder. Every tier includes monthly build
            power so you keep shipping.
          </p>
        </div>

        {/* Tiers */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {courseTiers.map((t) => {
            const action = courseCheckout.bind(null, t.id);
            const current = tier?.id === t.id;
            return (
              <div
                key={t.id}
                className={cn(
                  "card flex flex-col p-6",
                  "popular" in t && t.popular && "ring-2 ring-coral",
                  current && "ring-2 ring-moss"
                )}
              >
                {"popular" in t && t.popular && !current && (
                  <span className="self-start rounded-full bg-coral px-3 py-1 text-xs font-medium text-white">
                    Most popular
                  </span>
                )}
                {current && (
                  <span className="self-start rounded-full bg-moss px-3 py-1 text-xs font-medium text-white">
                    Your plan
                  </span>
                )}
                <h3 className="mt-2 text-xl font-semibold">{t.name}</h3>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="font-display text-3xl font-bold">{formatMoney(t.amount)}</span>
                  <span className="text-sm text-warmgrey">/mo</span>
                </div>
                <p className="mt-2 text-sm text-coral">
                  {formatNumber(t.monthlyPower)} build power / month
                </p>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm text-charcoal-soft">
                  {t.perks.map((p) => (
                    <li key={p} className="flex gap-2">
                      <Check className="h-4 w-4 shrink-0 text-moss" /> {p}
                    </li>
                  ))}
                </ul>
                {current ? (
                  <button disabled className="btn-secondary mt-5 w-full opacity-70">
                    Current plan
                  </button>
                ) : user ? (
                  <form action={action} className="mt-5">
                    <button className="btn-primary w-full">Choose {t.name}</button>
                  </form>
                ) : (
                  <Link href="/signup" className="btn-primary mt-5 w-full">
                    Sign up to join
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Lessons (gated) */}
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-semibold">Lessons</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {lessons.map((l) => {
              const unlocked = l.free || subscribed;
              return (
                <div
                  key={l.title}
                  className={cn("card flex items-center gap-3 p-4", !unlocked && "opacity-70")}
                >
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sand text-coral">
                    {unlocked ? <PlayCircle className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                  </span>
                  <span className="flex-1 font-medium">{l.title}</span>
                  {!unlocked && <span className="text-xs text-warmgrey">Locked</span>}
                </div>
              );
            })}
          </div>
        </section>

        {/* 1-1 booking placeholder (Founder tier) */}
        <section className="mt-8">
          <div className="card flex flex-col items-start justify-between gap-3 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sand text-coral">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">Book a 1-on-1</p>
                <p className="text-sm text-charcoal-soft">
                  {tier?.id === "course_founder"
                    ? "Included with Founder — grab a time."
                    : "Available on the Founder plan."}
                </p>
              </div>
            </div>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className={cn("btn-secondary", tier?.id !== "course_founder" && "pointer-events-none opacity-60")}
            >
              Open calendar (link soon)
            </a>
          </div>
        </section>
      </main>
    </>
  );
}
