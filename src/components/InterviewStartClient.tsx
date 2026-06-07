"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Interview } from "@/components/Interview";
import { COLD_START_KEY, PENDING_IDEA_KEY } from "@/lib/landingHandoff";
import {
  FIRST_INTERVIEW_QUESTION,
  resolveNextStep,
} from "@/lib/interviewFlow";
import { estimateInterviewProgress } from "@/lib/interviewPlan";
import type { PoolQuestionId } from "@/lib/interviewQuestionPool";
import {
  startInterviewCold,
  startInterviewFromIdea,
} from "@/server/projects";
import type { InterviewTurn } from "@/lib/types";

export function InterviewStartClient() {
  const router = useRouter();
  const [mode, setMode] = useState<"idea" | "cold" | null>(null);
  const [idea, setIdea] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [interviewPlan, setInterviewPlan] = useState<PoolQuestionId[]>([]);

  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_IDEA_KEY)?.trim();
    const cold = sessionStorage.getItem(COLD_START_KEY) === "1";
    sessionStorage.removeItem(PENDING_IDEA_KEY);
    sessionStorage.removeItem(COLD_START_KEY);

    if (pending) {
      setMode("idea");
      setIdea(pending);
      void startInterviewFromIdea(pending).then((res) => {
        if ("projectId" in res) {
          setProjectId(res.projectId);
          setInterviewPlan(res.interviewPlan);
          window.history.replaceState(null, "", `/project/${res.projectId}/build`);
          return;
        }
        router.replace("/#start");
      });
      return;
    }

    if (cold) {
      setMode("cold");
      void startInterviewCold().then((res) => {
        setProjectId(res.projectId);
        window.history.replaceState(null, "", `/project/${res.projectId}/build`);
      });
      return;
    }

    router.replace("/");
  }, [router]);

  if (!mode) return null;

  if (mode === "cold") {
    return (
      <Interview
        projectId={projectId ?? ""}
        ready={Boolean(projectId)}
        initialStep={FIRST_INTERVIEW_QUESTION}
        initialBubbles={[]}
        guestFlow
        initialProgress={{ current: 1, total: 5 }}
        bootstrap={{ kind: "firstQuestion", question: FIRST_INTERVIEW_QUESTION }}
      />
    );
  }

  if (!idea) return null;

  const turn: InterviewTurn = {
    questionId: "idea",
    question: FIRST_INTERVIEW_QUESTION.prompt,
    answer: idea,
  };
  const interview = [turn];
  const nextStep = resolveNextStep(interview, "idea", interviewPlan);
  if (!nextStep) {
    router.replace("/");
    return null;
  }

  const progress = estimateInterviewProgress(interview, nextStep.id, interviewPlan);

  return (
    <Interview
      projectId={projectId ?? ""}
      ready={Boolean(projectId)}
      initialStep={nextStep}
      initialBubbles={[
        { id: "u-idea", role: "user", text: idea, questionId: "idea" },
      ]}
      guestFlow
      initialProgress={progress}
      bootstrap={{ kind: "afterAnswerPending", question: nextStep }}
    />
  );
}
