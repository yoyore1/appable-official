import { redirect } from "next/navigation";
import { Background } from "@/components/Background";
import { AppNav } from "@/components/AppNav";
import { Interview } from "@/components/Interview";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";

export default async function BuildPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const project = await db.getProject(params.id);
  if (!project || project.userId !== user.id) redirect("/dashboard");
  if (project.masterPrompt) redirect(`/project/${project.id}`);

  return (
    <>
      <Background calm />
      <AppNav user={user} />
      <main className="mx-auto flex max-w-2xl flex-col px-5 py-6" style={{ height: "calc(100vh - 64px)" }}>
        <div className="mb-3">
          <h1 className="text-xl font-semibold">Let&apos;s build your app</h1>
          <p className="text-sm text-charcoal-soft">
            Five quick questions. Answer like you&apos;re texting a friend.
          </p>
        </div>
        <div className="card-float flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          <Interview projectId={project.id} />
        </div>
      </main>
    </>
  );
}
