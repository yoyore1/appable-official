import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ExternalLink,
  Rocket,
  FileText,
  ShieldCheck,
  LifeBuoy,
  MonitorDown,
} from "lucide-react";
import { Background } from "@/components/Background";
import { AppNav } from "@/components/AppNav";
import { PhonePreview } from "@/components/PhonePreview";
import { LaunchPanel } from "@/components/LaunchPanel";
import { Confetti } from "@/components/Confetti";
import { CopyProjectId } from "@/components/CopyProjectId";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { launchPackCheckout } from "@/server/checkout";
import { prices } from "@/lib/config";
import { formatMoney } from "@/lib/utils";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { celebrate?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const project = await db.getProject(params.id);
  if (!project || project.userId !== user.id) redirect("/dashboard");
  if (!project.masterPrompt) redirect(`/project/${project.id}/build`);

  const mp = project.masterPrompt;
  const buyLaunch = launchPackCheckout.bind(null, project.id);

  return (
    <>
      <Background calm />
      <AppNav user={user} />
      {searchParams.celebrate && <Confetti />}

      <main className="mx-auto max-w-4xl px-5 py-6">
        <Link href="/dashboard" className="text-sm text-warmgrey hover:text-charcoal">
          ← Back to dashboard
        </Link>

        <div className="mt-4 grid items-center gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
          <div className="reveal reveal-1 flex justify-center lg:sticky lg:top-20 lg:self-center">
            <PhonePreview
              hue={8 + project.thumbnailHue}
              label={mp.appName}
              status={mp.vibe}
              description={mp.description}
              features={mp.features}
              className="w-[240px] max-w-[240px]"
            />
          </div>

          <div className="reveal reveal-2 min-w-0 space-y-3">
            <div className="rounded-xl border border-line/50 bg-white/60 p-4 shadow-soft">
              <span className="label">Your app</span>
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight">{mp.appName}</h1>
              <p className="mt-1.5 text-xs leading-relaxed text-charcoal-soft">
                {mp.description}
              </p>

              <dl className="mt-3 grid gap-2.5 border-t border-line/50 pt-3 sm:grid-cols-3">
                <MetaItem label="For" value={mp.audience} />
                <MetaItem label="Style" value={mp.vibe} />
                <MetaItem label="Colors" value={mp.colors} />
              </dl>

              <div className="mt-3 border-t border-line/50 pt-3">
                <p className="label mb-2">Features</p>
                <ul className="space-y-1.5">
                  {mp.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-xs leading-snug text-charcoal"
                    >
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-coral" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <section className="overflow-hidden rounded-xl border border-line/60 bg-cream/85 shadow-soft">
              <div className="grid lg:grid-cols-[1.2fr_minmax(180px,0.85fr)]">
                <div className="border-b border-line/60 p-4 lg:border-b-0 lg:border-r">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-coral text-xs font-bold text-white">
                      A
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold">Build it in Appable Builder</h2>
                      <p className="text-xs text-warmgrey">Describe it. Build it. Ship it.</p>
                    </div>
                  </div>

                  <p className="text-sm font-medium text-charcoal">
                    This is your blueprint — not a finished app yet.
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-charcoal-soft">
                    To turn <strong className="font-semibold text-charcoal">{mp.appName}</strong>{" "}
                    into a real iOS app, download{" "}
                    <strong className="font-semibold text-charcoal">Appable Builder</strong> on
                    your computer. That&apos;s the only way to build it — there&apos;s no shortcut
                    on the website.
                  </p>

                  <ol className="mt-3 space-y-2 text-xs text-charcoal-soft">
                    <li className="flex gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-coral/15 text-[10px] font-bold text-coral-deep">
                        1
                      </span>
                      <span>
                        <strong className="font-semibold text-charcoal">
                          Download Appable Builder
                        </strong>{" "}
                        on your Mac — free to install
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-coral/15 text-[10px] font-bold text-coral-deep">
                        2
                      </span>
                      <span>
                        Open it and tap{" "}
                        <em className="font-medium text-charcoal">I already made my plan</em>
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-coral/15 text-[10px] font-bold text-coral-deep">
                        3
                      </span>
                      <span>Paste your project ID from the box on the right</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-coral/15 text-[10px] font-bold text-coral-deep">
                        4
                      </span>
                      <span>Build, polish your screens, then launch</span>
                    </li>
                  </ol>
                </div>

                <div className="flex flex-col justify-center gap-2.5 bg-sand/25 p-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-warmgrey">
                      Your project ID
                    </p>
                    <code className="mt-1 block break-all rounded-lg border border-line bg-white px-3 py-2 font-mono text-[11px] text-charcoal">
                      {project.id}
                    </code>
                  </div>

                  <CopyProjectId projectId={project.id} compact />

                  <button
                    type="button"
                    disabled
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-coral/30 bg-coral/8 px-3 py-2 text-xs font-semibold text-coral-deep"
                  >
                    <MonitorDown className="h-3.5 w-3.5" />
                    Download Appable Builder
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>

        <section className="mt-6 reveal reveal-3">
          <h2 className="mb-2 text-lg font-semibold">Included free</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <DocLink href={project.legal.privacyUrl} icon={ShieldCheck} title="Privacy Policy" />
            <DocLink href={project.legal.termsUrl} icon={FileText} title="Terms of Service" />
            <DocLink href={project.legal.supportUrl} icon={LifeBuoy} title="Support page" />
          </div>
        </section>

        <section className="mt-6 reveal reveal-4">
          <div className="mb-2 flex items-center gap-2">
            <Rocket className="h-4 w-4 text-coral" />
            <h2 className="text-lg font-semibold">Launch pack</h2>
          </div>
          {project.launch.purchased ? (
            <LaunchPanel projectId={project.id} launch={project.launch} />
          ) : (
            <div className="card flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm text-charcoal-soft">
                  App Store screenshots, icon, store copy, and 3 video ad scripts —
                  everything to launch.
                </p>
                <p className="mt-1 text-xs text-warmgrey">
                  Or buy à la carte: ASO {formatMoney(prices.launchAddons.aso.amount)} ·
                  Screenshots {formatMoney(prices.launchAddons.screenshots.amount)} ·
                  Video {formatMoney(prices.launchAddons.video.amount)}
                </p>
              </div>
              <form action={buyLaunch}>
                <button className="btn-primary whitespace-nowrap">
                  Get Launch Pack {formatMoney(prices.launchPack.amount)}
                </button>
              </form>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-warmgrey">
        {label}
      </dt>
      <dd className="mt-0.5 text-xs font-medium leading-snug text-charcoal">{value}</dd>
    </div>
  );
}

function DocLink({
  href,
  icon: Icon,
  title,
}: {
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      className="card flex items-center gap-2.5 p-3 transition hover:-translate-y-0.5"
    >
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-moss/10 text-moss">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm font-medium">{title}</span>
      <ExternalLink className="h-4 w-4 text-warmgrey" />
    </a>
  );
}
