import Link from "next/link";
import {
  ArrowRight,
  MessageCircle,
  LayoutGrid,
  Smartphone,
  Play,
  Sparkles,
} from "lucide-react";
import { Background } from "@/components/Background";
import { ExplainerVideoPlaceholder } from "@/components/ExplainerVideoPlaceholder";
import { LandingHashScroll } from "@/components/LandingHashScroll";
import { LandingHero } from "@/components/LandingHero";
import { MarketingNav } from "@/components/MarketingNav";
import { ScrollToBuildLink } from "@/components/ScrollToBuildLink";
import { PhonePreview } from "@/components/PhonePreview";
import { getCurrentUser } from "@/lib/session";

const sampleApps = [
  { name: "PlantPal", status: "Live on the App Store", hue: 130 },
  { name: "MoodNotes", status: "Built in 1 afternoon", hue: 8 },
  { name: "RunStreak", status: "Just submitted 🎉", hue: 28 },
];

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <>
      <Background />
      <MarketingNav user={user} />
      <LandingHashScroll />

      {/* Hero */}
      <section
        id="start"
        className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-16 pt-10 sm:pt-16"
      >
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <span className="reveal reveal-1 inline-flex items-center gap-2 rounded-full bg-cream/80 px-4 py-1.5 text-sm text-charcoal-soft shadow-soft backdrop-blur">
              <Sparkles className="h-4 w-4 text-coral" /> No coding. Seriously.
            </span>
            <h1 className="reveal reveal-2 mt-5 font-display text-5xl font-bold leading-[1.05] text-balance sm:text-6xl">
              Build your first app <span className="text-coral">free</span>.
            </h1>
            <p className="reveal reveal-3 mt-5 max-w-md text-lg text-charcoal-soft">
              You have an idea. We&apos;ll turn it into a real app on the App
              Store — through a friendly chat. No code. No jargon.
            </p>

            <LandingHero />
          </div>

          {/* Project preview cards */}
          <div className="reveal reveal-3 grid grid-cols-3 gap-3 self-start sm:gap-4 lg:sticky lg:top-24">
            {sampleApps.map((a, i) => (
              <div
                key={a.name}
                className={`card-float p-2 ${i === 1 ? "translate-y-6" : ""}`}
              >
                <PhonePreview hue={a.hue} label={a.name} status={a.status} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 60-second explainer */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="card-float mx-auto flex max-w-3xl flex-col items-center gap-4 p-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-coral/10">
            <Play className="h-6 w-6 text-coral" />
          </div>
          <h2 className="text-2xl font-semibold">See it in 60 seconds</h2>
          <p className="max-w-md text-charcoal-soft">
            Watch an idea become a real, installable app — start to finish.
          </p>
          <ExplainerVideoPlaceholder />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-coral">Three steps. No dev talk.</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-charcoal sm:text-4xl">
            From &ldquo;I have an idea&rdquo; to an app on the App Store
          </h2>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            {
              step: "1",
              icon: MessageCircle,
              title: "Say what you want",
              body: "Type your idea on the homepage, or tap Suggest ideas for three proven directions if you're not sure yet. Then a few easy follow-ups, like a normal chat.",
            },
            {
              step: "2",
              icon: LayoutGrid,
              title: "See real screens",
              body: "Your app shows up with a home page, buttons, and flow you can tap through. Change anything by telling us.",
            },
            {
              step: "3",
              icon: Smartphone,
              title: "Try it on your phone",
              body: "Preview it like a real download. When you like it, we help you get App Store-ready with screenshots and marketing copy.",
            },
          ].map((s, i) => (
            <div
              key={s.title}
              className={`relative rounded-[1.35rem] border border-line/60 bg-white/80 p-6 shadow-soft backdrop-blur reveal reveal-${i + 1}`}
            >
              <div className="flex items-center gap-3">
                <span className="font-display text-2xl font-bold text-coral/35">{s.step}</span>
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-line/50 bg-cream/90">
                  <s.icon className="h-5 w-5 text-charcoal-soft" strokeWidth={1.75} />
                </div>
              </div>
              <h3 className="mt-5 text-lg font-semibold text-charcoal">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-charcoal-soft">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-display text-2xl font-bold text-charcoal sm:text-3xl">
            People who&apos;d never coded before
          </h2>
          <p className="mt-2 text-charcoal-soft">
            Side projects, small businesses, stuff they kept in Notes for months.
          </p>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {[
            {
              quote:
                "I kept putting off PlantPal because I thought I'd need a developer. Answered questions for twenty minutes and had something I could show my sister.",
              name: "Maya",
              app: "PlantPal",
            },
            {
              quote:
                "MoodNotes started as a notes-app rant. Didn't feel like 'using AI'. More like someone building it with me while we texted.",
              name: "Theo",
              app: "MoodNotes",
            },
            {
              quote:
                "RunStreak went from an idea to live on the App Store in about a week. I still don't know what React is and I'm not mad about it.",
              name: "Sam",
              app: "RunStreak",
            },
          ].map((t) => (
            <figure
              key={t.app}
              className="flex h-full flex-col rounded-[1.35rem] border border-line/60 bg-cream/50 p-6"
            >
              <blockquote className="flex-1 text-[15px] leading-relaxed text-charcoal">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-5 border-t border-line/40 pt-4">
                <p className="font-medium text-charcoal">{t.name}</p>
                <p className="text-sm text-warmgrey">Built {t.app}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="overflow-hidden rounded-[1.75rem] border border-line/50 bg-gradient-to-br from-white via-cream/90 to-coral/5 p-10 text-center shadow-float sm:p-12">
          <p className="text-sm font-medium text-charcoal-soft">
            Still thinking about it in your head?
          </p>
          <h2 className="mx-auto mt-3 max-w-lg font-display text-3xl font-bold text-balance text-charcoal sm:text-4xl">
            Put it in the box above and see what it could look like.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-charcoal-soft">
            Free to start. No credit card. If it&apos;s not your thing, you&apos;ve lost ten minutes — not ten grand.
          </p>
          <ScrollToBuildLink className="btn-primary btn-pill mt-7">
            Try it free <ArrowRight className="h-5 w-5" />
          </ScrollToBuildLink>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 py-10 text-sm text-warmgrey">
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <span>© {new Date().getFullYear()} Appable</span>
          <div className="flex gap-4">
            <Link href="/course" className="hover:text-charcoal">Course</Link>
            <Link href="/login" className="hover:text-charcoal">Sign in</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
