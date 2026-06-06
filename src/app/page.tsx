import Link from "next/link";
import { ArrowRight, Sparkles, Wand2, Rocket, Play } from "lucide-react";
import { Background } from "@/components/Background";
import { MarketingNav } from "@/components/MarketingNav";
import { PhonePreview } from "@/components/PhonePreview";

const sampleApps = [
  { name: "PlantPal", status: "Live on the App Store", hue: 130 },
  { name: "MoodNotes", status: "Built in 1 afternoon", hue: 8 },
  { name: "RunStreak", status: "Just submitted 🎉", hue: 28 },
];

export default function LandingPage() {
  return (
    <>
      <Background />
      <MarketingNav />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
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

            {/* One inviting hero chat input */}
            <form
              action="/signup"
              className="reveal reveal-4 mt-7 flex items-center gap-2 rounded-2xl bg-cream/90 p-2 shadow-float backdrop-blur"
            >
              <input
                name="idea"
                className="w-full bg-transparent px-3 py-2.5 text-charcoal outline-none placeholder:text-warmgrey"
                placeholder="My app idea is…"
                aria-label="Your app idea"
              />
              <button className="btn-primary whitespace-nowrap">
                Start building <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            <p className="reveal reveal-5 mt-3 text-sm text-warmgrey">
              $1 to get started — that&apos;s it. It goes toward your first build.
            </p>
          </div>

          {/* Project preview cards */}
          <div className="reveal reveal-3 grid grid-cols-3 gap-3 sm:gap-4">
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
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-sand">
            <div className="grid h-full w-full place-items-center text-warmgrey">
              Explainer video coming soon
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            { icon: Sparkles, title: "Tell us your idea", body: "A short, friendly chat. Five questions, that's it." },
            { icon: Wand2, title: "We build it", body: "Your app comes to life — onboarding, screens, the works." },
            { icon: Rocket, title: "Launch it", body: "Screenshots, store copy, and it's ready for the App Store." },
          ].map((s, i) => (
            <div key={s.title} className={`card p-6 reveal reveal-${i + 1}`}>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-coral/10">
                <s.icon className="h-5 w-5 text-coral" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-charcoal-soft">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="mx-auto max-w-6xl px-5 py-12">
        <p className="text-center text-sm uppercase tracking-wide text-warmgrey">
          Loved by first-time founders
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["“I built my app over a weekend. I don't code.”", "— Maya, PlantPal"],
            ["“It felt like texting a friend who happens to be a developer.”", "— Theo, MoodNotes"],
            ["“On the App Store in days, not months.”", "— Sam, RunStreak"],
          ].map(([quote, who]) => (
            <figure key={who} className="card p-6">
              <blockquote className="text-charcoal">{quote}</blockquote>
              <figcaption className="mt-3 text-sm text-warmgrey">{who}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="card-float flex flex-col items-center gap-5 p-10 text-center">
          <h2 className="max-w-xl text-3xl font-bold text-balance sm:text-4xl">
            Your idea deserves to be a real app.
          </h2>
          <Link href="/signup" className="btn-primary btn-pill">
            Build your first app free <ArrowRight className="h-5 w-5" />
          </Link>
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
