import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import {
  ExternalLink,
  Rocket,
  FileText,
  ShieldCheck,
  LifeBuoy,
} from "lucide-react";
import { Background } from "@/components/Background";
import { AppNav } from "@/components/AppNav";
import { PhonePreview } from "@/components/PhonePreview";
import { LaunchPanel } from "@/components/LaunchPanel";
import { Confetti } from "@/components/Confetti";
import { BuilderHandoff } from "@/components/BuilderHandoff";
import { GUEST_USER_ID } from "@/lib/guestProject";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { launchPackCheckout } from "@/server/checkout";
import { prices } from "@/lib/config";
import { isExpoAppBuilt } from "@/lib/projectRoutes";
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
  if (!project) redirect("/dashboard");

  if (project.userId === GUEST_USER_ID) {
    redirect(`/signup?project=${project.id}`);
  }

  if (project.userId !== user.id) redirect("/dashboard");

  if (!user.depositPaid) {
    redirect(`/deposit?project=${project.id}`);
  }
  if (!project.masterPrompt) redirect(`/project/${project.id}/build`);

  if (isExpoAppBuilt(project)) {
    const q = searchParams.celebrate ? "?celebrate=1" : "";
    redirect(`/project/${project.id}/expo${q}`);
  }

  const mp = project.masterPrompt;
  const buyLaunch = launchPackCheckout.bind(null, project.id);

  // Server-side device detection routes mobile users to the right option.
  const ua = headers().get("user-agent") ?? "";
  const isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);

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

            <section className="overflow-hidden rounded-xl border border-line/60 bg-cream/85 p-4 shadow-soft">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-coral text-xs font-bold text-white">
                  A
                </span>
                <div>
                  <h2 className="text-sm font-semibold">Turn it into a real app</h2>
                  <p className="text-xs text-warmgrey">
                    Pick how to build {mp.appName}. We&apos;ll open it for you — no codes to copy.
                  </p>
                </div>
              </div>

              <BuilderHandoff
                projectId={project.id}
                appName={mp.appName}
                isMobile={isMobile}
                initialTarget={project.target}
              />
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
