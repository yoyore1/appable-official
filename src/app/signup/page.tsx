import { Background } from "@/components/Background";
import { Logo } from "@/components/Logo";
import { AuthForm } from "@/components/AuthForm";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { prices } from "@/lib/config";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { project?: string };
}) {
  const projectId = searchParams.project?.trim();
  let headline = "Save your app";
  let sub =
    "Create a free account so we can keep your idea, your plan, and your progress — pick up anytime.";
  let footnote = "";

  if (projectId) {
    const project = await db.getProject(projectId);
    if (project?.masterPrompt) {
      headline = `${project.masterPrompt.appName} is ready`;
      sub =
        "Sign up to save your app to your account. We'll keep your plan, interview answers, and build — nothing gets lost if you close the tab.";
      footnote = `After signup, a ${formatMoney(prices.deposit.amount)} returnable deposit unlocks your build. Refunded when you subscribe.`;
    } else {
      headline = "Almost there";
      sub =
        "Your interview answers are saved on this device — create an account so we can keep them for you.";
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
          <h1 className="text-2xl font-bold">{headline}</h1>
          <p className="mt-2 text-sm leading-relaxed text-charcoal-soft">{sub}</p>
          {footnote && (
            <p className="mt-3 rounded-xl bg-sand/60 px-3 py-2 text-xs leading-relaxed text-charcoal-soft">
              {footnote}
            </p>
          )}
          <div className="mt-6">
            <AuthForm mode="signup" projectId={projectId} />
          </div>
        </div>
      </main>
    </>
  );
}
