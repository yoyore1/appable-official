"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  clearGuestProjectCookie,
  getGuestProjectId,
  GUEST_USER_ID,
  setGuestProjectCookie,
} from "@/lib/guestProject";
import { resolveProjectAccess } from "@/lib/projectAccess";
import { requireUser } from "@/lib/session";
import { canSpend, ESTIMATED_COST_USD } from "@/lib/aiUsage";
import { recordAiSpend } from "@/lib/aiSpend";
import {
  generateAso,
  generateMasterPrompt,
  generateScreenshots,
  generateVideoAds,
  interviewAck,
} from "@/lib/models";
import {
  isDeferToRecommendation,
  recommendColorsAck,
} from "@/lib/designResearch";
import {
  isAppablePick,
  resolveInterviewAnswer,
  suggestForStep,
} from "@/lib/interviewSuggestions";
import { clearBuildProgress, setBuildProgress } from "@/lib/buildProgressStore";
import {
  FIRST_INTERVIEW_QUESTION,
  resolveNextStep,
  getProgress,
  getStepById,
  isInterviewDone,
  type InterviewStep,
  type InterviewStepId,
} from "@/lib/interviewFlow";
import { ensureRepoForApp } from "@/lib/github";
import { builderDeepLink, handoffFallbackUrl } from "@/lib/handoff";
import { applyExpoTweak } from "@/lib/expoApp/applyTweak";
import { buildExpoAppModel } from "@/lib/expoApp/generate";
import type { ExpoAppModel } from "@/lib/expoApp/types";
import type { BuildTarget, InterviewTurn, MasterBuildPrompt } from "@/lib/types";

export async function createProjectAction() {
  const user = await requireUser();
  const project = await db.createProject(user.id);
  redirect(`/project/${project.id}/build`);
}

/** Landing hero → guest project with idea pre-filled → interview. */
export async function startInterviewAction(formData: FormData) {
  const idea = String(formData.get("idea") ?? "").trim();
  if (!idea) redirect("/#start");

  const project = await db.createProject(GUEST_USER_ID);
  const turn: InterviewTurn = {
    questionId: "idea",
    question: FIRST_INTERVIEW_QUESTION.prompt,
    answer: idea,
  };
  await db.updateProject(project.id, { interview: [turn] });
  setGuestProjectCookie(project.id);
  redirect(`/project/${project.id}/build`);
}

/** Attach a guest project to the user after signup / sign-in. */
export async function claimGuestProject(
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await db.getProject(projectId);
  if (!project || project.userId !== GUEST_USER_ID) return false;
  if (getGuestProjectId() !== projectId) return false;
  await db.updateProject(projectId, { userId });
  clearGuestProjectCookie();
  return true;
}

export type AnswerInterviewResult =
  | {
      ok: true;
      acks: string[];
      done: boolean;
      nextStep?: InterviewStep;
      /** Resolved text when user picked “Let Appable pick”. */
      storedAnswer?: string;
      suggestions?: string[];
      progress: { current: number; total: number };
    }
  | { ok: false; error: "auth" | "project" };

/** Record one interview answer and return the next question (or trigger build). */
export async function answerInterview(
  projectId: string,
  questionId: InterviewStepId,
  answer: string
): Promise<AnswerInterviewResult> {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) {
    return {
      ok: false,
      error: access.reason === "missing" ? "project" : "auth",
    };
  }
  const project = access.project;

  const raw =
    questionId === "colors" && !answer.trim() ? "No preference" : answer.trim();
  const normalized = resolveInterviewAnswer(questionId, raw, project.interview);

  const step = getStepById(project.interview, questionId) ?? {
    id: questionId,
    prompt: questionId,
    kind: "text" as const,
  };

  const turn: InterviewTurn = {
    questionId,
    question: step.prompt,
    answer: normalized,
  };
  const existingIdx = project.interview.findIndex(
    (t) => t.questionId === questionId
  );
  const interview =
    existingIdx >= 0
      ? [...project.interview.slice(0, existingIdx), turn]
      : [...project.interview, turn];

  await db.updateProject(projectId, { interview });

  const done = isInterviewDone(interview, questionId);

  let acks: string[];
  try {
    if (questionId === "colors" && (isAppablePick(raw) || isDeferToRecommendation(normalized))) {
      acks = [recommendColorsAck(interview)];
    } else {
      acks = await interviewAck(normalized, questionId, interview);
    }
  } catch {
    acks = await interviewAck(normalized, questionId, interview);
  }

  const nextStep = done ? undefined : resolveNextStep(interview, questionId) ?? undefined;

  const suggestions = nextStep
    ? suggestForStep(nextStep.id, interview)
    : undefined;

  const progress = getProgress(
    interview,
    nextStep?.id ?? questionId
  );

  return {
    ok: true,
    acks,
    done,
    nextStep,
    storedAnswer: normalized !== raw ? normalized : undefined,
    suggestions,
    progress,
  };
}

/** Synthesize + store the master build prompt, mark project ready. */
export async function finishInterview(projectId: string) {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) throw new Error("NOT_FOUND");
  const project = access.project;

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

export type OpenInBuilderResult = {
  deepLink: string;
  fallbackUrl: string;
  target: BuildTarget;
};

/** Mint a handoff token and return the Builder deep link (Swift path). */
export async function openInBuilder(
  projectId: string,
  target: BuildTarget
): Promise<OpenInBuilderResult> {
  const user = await requireUser();
  const project = await db.getProject(projectId);
  if (!project || project.userId !== user.id) throw new Error("NOT_FOUND");
  if (!project.masterPrompt) throw new Error("NO_PROMPT");

  const githubRepoUrl = await ensureRepoForApp(project);
  await db.updateProject(projectId, { target, githubRepoUrl });

  const handoff = await db.createHandoff(user.id, projectId, target);
  return {
    deepLink: builderDeepLink(handoff.token, target),
    fallbackUrl: handoffFallbackUrl(handoff.token),
    target,
  };
}

/** Mark RN web build path without opening the desktop Builder. */
export async function prepareExpoBuild(projectId: string) {
  const user = await requireUser();
  const project = await db.getProject(projectId);
  if (!project || project.userId !== user.id) throw new Error("NOT_FOUND");
  await db.updateProject(projectId, { target: "rn" });
}

export async function updateExpoPlan(
  projectId: string,
  patch: MasterBuildPrompt
): Promise<MasterBuildPrompt> {
  const user = await requireUser();
  const project = await db.getProject(projectId);
  if (!project || project.userId !== user.id) throw new Error("NOT_FOUND");

  await db.updateProject(projectId, {
    masterPrompt: patch,
    name: patch.appName,
    vibe: patch.vibe,
    expoAppModel: null,
  });
  revalidatePath(`/project/${projectId}`);
  return patch;
}

export type ExpoWebBuildResult = {
  model: ExpoAppModel;
  passes: number;
};

/** Multi-pass Expo content build — persists ExpoAppModel on the project. */
export async function runExpoWebBuild(
  projectId: string
): Promise<ExpoWebBuildResult> {
  const user = await requireUser();
  const project = await db.getProject(projectId);
  if (!project || project.userId !== user.id) throw new Error("NOT_FOUND");
  if (!project.masterPrompt) throw new Error("NO_PROMPT");

  clearBuildProgress(projectId);
  const mp = project.masterPrompt;
  setBuildProgress(projectId, {
    stepId: "plan",
    label: `Reading ${mp.appName}'s plan…`,
    index: 0,
    total: 8,
    percent: 8,
  });
  const { model, passes } = await buildExpoAppModel(mp, projectId);
  await db.updateProject(projectId, {
    expoAppModel: model,
    target: "rn",
    status: "building",
  });
  revalidatePath(`/project/${projectId}`);
  setTimeout(() => clearBuildProgress(projectId), 60_000);
  return { model, passes };
}

/** Post-build tweak chat — cheap model, counts against $0.55 AI cap. */
export async function expoTweakChat(
  projectId: string,
  message: string
): Promise<
  | { ok: true; reply: string; model: ExpoAppModel }
  | { ok: false; reason: "cap_reached" | "error"; message: string }
> {
  const user = await requireUser();
  const project = await db.getProject(projectId);
  if (!project || project.userId !== user.id) throw new Error("NOT_FOUND");
  if (!project.masterPrompt || !project.expoAppModel) throw new Error("NO_PROMPT");

  const mp = project.masterPrompt;
  const result = await applyExpoTweak(project.expoAppModel, mp, message);

  const changed = JSON.stringify(result.model) !== JSON.stringify(project.expoAppModel);
  if (changed && canSpend(user.aiUsageUsd, "cheap_text")) {
    await recordAiSpend(user.id, ESTIMATED_COST_USD.cheap_text);
  }

  if (changed) {
    await db.updateProject(projectId, { expoAppModel: result.model });
    revalidatePath(`/project/${projectId}/expo`);
  }

  return { ok: true, reply: result.reply, model: result.model };
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
