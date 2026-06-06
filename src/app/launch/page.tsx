import { redirect } from "next/navigation";
import Link from "next/link";
import { Rocket, ArrowRight } from "lucide-react";
import { Background } from "@/components/Background";
import { AppNav } from "@/components/AppNav";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

export default async function LaunchPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const projects = (await db.listProjects(user.id)).filter((p) => p.masterPrompt);

  return (
    <>
      <Background calm />
      <AppNav user={user} />
      <main className="mx-auto max-w-3xl px-5 py-8">
        <div className="mb-6 flex items-center gap-2">
          <Rocket className="h-6 w-6 text-coral" />
          <h1 className="text-3xl font-bold">Launch pack</h1>
        </div>
        <p className="text-charcoal-soft">
          Pick an app to get App Store screenshots, an icon, store copy, and video
          ad scripts.
        </p>

        <div className="mt-6 space-y-3">
          {projects.length === 0 ? (
            <div className="card p-8 text-center text-charcoal-soft">
              Build an app first, then come back to launch it.
            </div>
          ) : (
            projects.map((p) => (
              <Link
                key={p.id}
                href={`/project/${p.id}`}
                className="card flex items-center justify-between p-4 transition hover:-translate-y-0.5"
              >
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-warmgrey">
                    {p.launch.purchased ? "Launch pack active" : "Not launched yet"}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-warmgrey" />
              </Link>
            ))
          )}
        </div>
      </main>
    </>
  );
}
