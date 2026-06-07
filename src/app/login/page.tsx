import { Background } from "@/components/Background";
import { Logo } from "@/components/Logo";
import { AuthForm } from "@/components/AuthForm";
import { db } from "@/lib/db";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { project?: string };
}) {
  const projectId = searchParams.project?.trim();
  let sub = "Pick up right where you left off.";

  if (projectId) {
    const project = await db.getProject(projectId);
    if (project?.masterPrompt) {
      sub = `Sign in to save ${project.masterPrompt.appName} to your account and continue.`;
    }
  }

  return (
    <>
      <Background />
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card-float p-7 reveal reveal-1">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-charcoal-soft">{sub}</p>
          <div className="mt-6">
            <AuthForm mode="login" projectId={projectId} />
          </div>
        </div>
      </main>
    </>
  );
}
