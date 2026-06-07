import { redirect } from "next/navigation";
import { Background } from "@/components/Background";
import { AppNav } from "@/components/AppNav";
import { GuestNav } from "@/components/GuestNav";
import { Interview, type InterviewBootstrap } from "@/components/Interview";
import { answerFor } from "@/lib/interviewHelpers";
import { initialInterviewStep } from "@/lib/interviewFlow";
import { interviewAck } from "@/lib/models";
import { suggestForStep } from "@/lib/interviewSuggestions";
import { resolveProjectAccess } from "@/lib/projectAccess";
import { getCurrentUser } from "@/lib/session";

export default async function BuildPage({ params }: { params: { id: string } }) {
  const access = await resolveProjectAccess(params.id);
  if (!access.ok) redirect("/");

  const { project, isGuest } = access;
  if (project.masterPrompt) {
    redirect(
      isGuest ? `/signup?project=${project.id}` : `/project/${project.id}`
    );
  }

  const user = await getCurrentUser();
  const initialStep = initialInterviewStep(project.interview);
  const ideaAnswer = answerFor(project.interview, "idea");

  const initialBubbles: {
    id: string;
    role: "ai" | "user";
    text: string;
    questionId?: "idea";
  }[] = [];
  if (ideaAnswer) {
    initialBubbles.push({
      id: "u-idea",
      role: "user",
      text: ideaAnswer,
      questionId: "idea",
    });
  }

  const progressStart = ideaAnswer
    ? { current: 2, total: 5 }
    : { current: 1, total: 5 };

  let bootstrap: InterviewBootstrap | undefined;
  if (ideaAnswer) {
    const acks = await interviewAck(ideaAnswer, "idea", project.interview);
    bootstrap = { kind: "afterAnswer", acks, question: initialStep };
  } else if (initialBubbles.length === 0 && initialStep.id === "idea") {
    bootstrap = { kind: "firstQuestion", question: initialStep };
  }

  return (
    <>
      <Background calm />
      {user && !isGuest ? <AppNav user={user} /> : <GuestNav />}
      <main
        className="mx-auto flex max-w-2xl flex-col px-5 py-6"
        style={{ height: "calc(100vh - 64px)" }}
      >
        <div className="mb-3">
          <h1 className="text-xl font-semibold">Let&apos;s build your app</h1>
          <p className="text-sm text-charcoal-soft">
            A few quick questions — answer like you&apos;re texting a friend.
          </p>
        </div>
        <div className="card-float flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          <Interview
            projectId={project.id}
            initialStep={initialStep}
            initialBubbles={initialBubbles}
            guestFlow={isGuest}
            initialProgress={progressStart}
            initialSuggestions={suggestForStep(initialStep.id, project.interview)}
            bootstrap={bootstrap}
          />
        </div>
      </main>
    </>
  );
}
