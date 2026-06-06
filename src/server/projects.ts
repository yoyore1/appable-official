"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import {
  generateAso,
  generateMasterPrompt,
  generateScreenshots,
  generateVideoAds,
  interviewAck,
} from "@/lib/models";
import { interviewQuestions } from "@/lib/config";
import { suggestColorOptions } from "@/lib/interviewHelpers";
import type { InterviewTurn } from "@/lib/types";

export async function createProjectAction() {
  const user = await requireUser();
  const project = await db.createProject(user.id);
  redirect(`/project/${project.id}/build`);
}

export type AnswerInterviewResult =
  | {
      ok: true;
      acks: string[];
      nextIndex: number;
      done: boolean;
      colorOptions?: string[];
      nextPrompt?: string;
    }
  | { ok: false; error: "auth" | "project" };

/** Record one interview answer and return the next question (or trigger build). */
export async function answerInterview(
  projectId: string,
  questionId: string,
  answer: string
): Promise<AnswerInterviewResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "auth" };
  }

  const project = await db.getProject(projectId);
  if (!project || project.userId !== user.id) {
    return { ok: false, error: "project" };
  }

  const q = interviewQuestions.find((x) => x.id === questionId);
  const turn: InterviewTurn = {
    questionId,
    question: q?.prompt ?? questionId,
    answer,
  };
  const interview = [
    ...project.interview.filter((t) => t.questionId !== questionId),
    turn,
  ];

  await db.updateProject(projectId, { interview });

  const idx = interviewQuestions.findIndex((x) => x.id === questionId);
  const done = idx >= interviewQuestions.length - 1;

  let acks: string[];
  try {
    acks = await interviewAck(answer, questionId);
  } catch {
    acks = ["Got it — love that.", "Love it."];
  }

  const nextIndex = idx + 1;
  const nextQ = done ? null : interviewQuestions[nextIndex];

  let colorOptions: string[] | undefined;
  let nextPrompt: string | undefined;
  if (nextQ?.id === "colors") {
    colorOptions = suggestColorOptions(interview);
    nextPrompt = nextQ.prompt;
  }

  return { ok: true, acks, nextIndex, done, colorOptions, nextPrompt };
}

/** Synthesize + store the master build prompt, mark project ready. */
export async function finishInterview(projectId: string) {
  const user = await requireUser();
  const project = await db.getProject(projectId);
  if (!project || project.userId !== user.id) throw new Error("NOT_FOUND");

  const masterPrompt = await generateMasterPrompt(project.interview);

  // Free inclusions: hosted Privacy / Terms / Support (see /app/legal route).
  const legal = {
    privacyUrl: `/legal/${projectId}/privacy`,
    termsUrl: `/legal/${projectId}/terms`,
    supportUrl: `/legal/${projectId}/support`,
  };

  await db.updateProject(projectId, {
    name: masterPrompt.appName,
    vibe: masterPrompt.vibe,
    masterPrompt,
    status: "ready",
    legal,
  });
  revalidatePath(`/project/${projectId}`);
}

export async function buyLaunchAsset(
  projectId: string,
  asset: "aso" | "screenshots" | "video"
) {
  const user = await requireUser();
  const project = await db.getProject(projectId);
  if (!project || project.userId !== user.id) throw new Error("NOT_FOUND");
  if (!project.masterPrompt) throw new Error("NO_PROMPT");

  const launch = { ...project.launch, purchased: true };
  if (asset === "aso") {
    launch.aso = await generateAso(project.masterPrompt);
  } else if (asset === "screenshots") {
    const r = await generateScreenshots(project.masterPrompt);
    launch.screenshots = r.screenshots;
    launch.icon = r.icon;
  } else if (asset === "video") {
    launch.videoAds = await generateVideoAds(project.masterPrompt);
  }
  await db.updateProject(projectId, { launch });
  revalidatePath(`/project/${projectId}`);
}

/** Generate ALL launch assets at once (full Launch Pack purchase). */
export async function generateFullLaunchPack(projectId: string) {
  const user = await requireUser();
  const project = await db.getProject(projectId);
  if (!project || project.userId !== user.id || !project.masterPrompt)
    throw new Error("NOT_FOUND");

  const [aso, shots, videoAds] = await Promise.all([
    generateAso(project.masterPrompt),
    generateScreenshots(project.masterPrompt),
    generateVideoAds(project.masterPrompt),
  ]);
  await db.updateProject(projectId, {
    launch: {
      purchased: true,
      aso,
      screenshots: shots.screenshots,
      icon: shots.icon,
      videoAds,
    },
  });
  revalidatePath(`/project/${projectId}`);
}
