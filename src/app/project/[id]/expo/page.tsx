import { redirect } from "next/navigation";
import Link from "next/link";
import { Background } from "@/components/Background";
import { AppNav } from "@/components/AppNav";
import { ExpoBuildRoom } from "@/components/ExpoBuildRoom";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

export default async function ExpoBuildPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const project = await db.getProject(params.id);
  if (!project || project.userId !== user.id) redirect("/dashboard");
  if (!user.depositPaid) redirect(`/deposit?project=${project.id}`);
  if (!project.masterPrompt) redirect(`/project/${project.id}/build`);

  const mp = project.masterPrompt;

  return (
    <>
      <Background calm />
      <AppNav user={user} />
      <main
        className="mx-auto flex w-full max-w-[min(100%,1680px)] flex-col px-4 py-6 sm:px-6 lg:px-8"
        style={{ height: "calc(100vh - 64px)" }}
      >
        <Link
          href={`/project/${project.id}`}
          className="mb-3 text-sm text-warmgrey hover:text-charcoal"
        >
          ← Back
        </Link>
        <div className="mb-3">
          <h1 className="text-xl font-semibold">Build {mp.appName} with Expo</h1>
          <p className="text-sm text-charcoal-soft">
            Chat on the left, live preview in the center, Expo Go on your phone
            on the right.
          </p>
        </div>
        <ExpoBuildRoom
          projectId={project.id}
          initialPlan={mp}
          initialModel={project.expoAppModel}
          interview={project.interview}
        />
      </main>
    </>
  );
}
