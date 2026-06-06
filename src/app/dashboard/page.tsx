import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Zap, Rocket, GraduationCap, Sparkles } from "lucide-react";
import { Background } from "@/components/Background";
import { AppNav } from "@/components/AppNav";
import { BuildPowerBar } from "@/components/BuildPowerBar";
import { ProjectCard } from "@/components/ProjectCard";
import { Confetti } from "@/components/Confetti";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { createProjectAction } from "@/server/projects";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { celebrate?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.depositPaid) redirect("/deposit");

  const projects = await db.listProjects(user.id);

  return (
    <>
      <Background calm />
      <AppNav user={user} />
      {searchParams.celebrate && <Confetti />}

      <main className="mx-auto max-w-6xl px-5 py-8">
        {/* Greeting + build power */}
        <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <div className="reveal reveal-1">
            <h1 className="text-3xl font-bold">
              Hey{user.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
            </h1>
            <p className="mt-1 text-charcoal-soft">
              {projects.length === 0
                ? "Let's build your first app. It starts with one idea."
                : "Welcome back. Pick up a project or start something new."}
            </p>
          </div>
          <div className="card p-5 reveal reveal-2">
            <BuildPowerBar power={user.buildPower} />
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <form action={createProjectAction}>
            <button className="card-float flex w-full items-center gap-3 p-4 text-left transition hover:-translate-y-0.5">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-coral text-white">
                <Plus className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold">New app</span>
                <span className="block text-xs text-charcoal-soft">Start the chat</span>
              </span>
            </button>
          </form>

          <ActionTile href="/buy" icon={Zap} title="Buy build power" sub="Keep building" />
          <ActionTile href="/launch" icon={Rocket} title="Launch pack" sub="Get App Store ready" />
          <ActionTile href="/course" icon={GraduationCap} title="Course" sub="Learn & level up" />
        </div>

        {/* Projects */}
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your apps</h2>
            {projects.length > 0 && (
              <span className="text-sm text-warmgrey">{projects.length} total</span>
            )}
          </div>

          {projects.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 p-12 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-coral/10">
                <Sparkles className="h-6 w-6 text-coral" />
              </span>
              <p className="text-lg font-semibold">No apps yet</p>
              <p className="max-w-sm text-sm text-charcoal-soft">
                Tell us your idea and we&apos;ll turn it into a real app. The first one&apos;s on us.
              </p>
              <form action={createProjectAction}>
                <button className="btn-primary mt-1">Build my first app</button>
              </form>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function ActionTile({
  href,
  icon: Icon,
  title,
  sub,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
}) {
  return (
    <Link href={href} className="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-soft">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-sand text-coral">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-charcoal-soft">{sub}</span>
      </span>
    </Link>
  );
}
