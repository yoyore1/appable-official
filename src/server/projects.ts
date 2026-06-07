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
import { runWithAiBilling } from "@/lib/aiBillingContext";
import { assertAiBudgetAvailable } from "@/lib/aiBudgetAccount";
import type { PublicAiUsage } from "@/lib/aiUsage";
import {
  generateAso,
  generateMasterPrompt,
  generateScreenshots,
  generateVideoAds,
  ackForAppablePick,
  interviewResolvePick,
  interviewSuggestionsForStep,
} from "@/lib/models";
import {
  isDeferToRecommendation,
  recommendColorsAck,
} from "@/lib/designResearch";
import {
  isAppablePick,
  resolveInterviewAnswer,
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
import {
  applySelectionTweak,
  type SelectionTweakAction,
} from "@/lib/expoApp/applySelectionTweak";
import { buildExpoAppModel } from "@/lib/expoApp/generate";
import type { ExpoAppModel } from "@/lib/expoApp/types";
import { answerFor } from "@/lib/interviewHelpers";
import type { BuildTarget, InterviewTurn, MasterBuildPrompt } from "@/lib/types";

export async function createProjectAction() {
  const user = await requireUser();
  const project = await db.createProject(user.id);
  redirect(`/project/${project.id}/build`);
}

/** Landing hero → guest project with idea saved (no AI — interview opens instantly). */
export async function startInterviewFromIdea(
  idea: string
): Promise<
  | { projectId: string; interviewPlan: import("@/lib/interviewQuestionPool").PoolQuestionId[] }
  | { error: "empty" }
> {
  const trimmed = idea.trim();
  if (!trimmed) return { error: "empty" };

  const project = await db.createProject(GUEST_USER_ID);
  const turn: InterviewTurn = {
    questionId: "idea",
    question: FIRST_INTERVIEW_QUESTION.prompt,
    answer: trimmed,
  };
  const interview = [turn];
  const { selectPoolQuestionsSync } = await import("@/lib/interviewQuestionPool");
  const syncPlan = selectPoolQuestionsSync(interview);
  await db.updateProject(project.id, { interview, interviewPlan: syncPlan });
  setGuestProjectCookie(project.id);

  void (async () => {
    try {
      const { interviewAiPickPoolPlan } = await import("@/lib/interviewAi");
      const kimiPlan = await interviewAiPickPoolPlan(interview);
      if (kimiPlan.length) {
        await db.updateProject(project.id, { interviewPlan: kimiPlan });
      }
    } catch {
      /* sync plan is enough */
    }
  })();

  return { projectId: project.id, interviewPlan: syncPlan };
}

/** "Start building" with no idea yet — opens interview on the first question. */
export async function startInterviewCold(): Promise<{ projectId: string }> {
  const project = await db.createProject(GUEST_USER_ID);
  setGuestProjectCookie(project.id);
  return { projectId: project.id };
}

/** Form action fallback (no-JS). */
export async function startInterviewAction(formData: FormData) {
  const idea = String(formData.get("idea") ?? "").trim();
  if (!idea) redirect("/#start");
  const res = await startInterviewFromIdea(idea);
  if ("error" in res) redirect("/#start");
  redirect(`/project/${res.projectId}/build`);
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
  const { mergeGuestAiSpend } = await import("@/lib/aiBudgetAccount");
  await mergeGuestAiSpend(projectId, userId);
  clearGuestProjectCookie();
  return true;
}

function billingScope(project: { id: string; userId: string }, isGuest: boolean) {
  return {
    projectId: project.id,
    ownerUserId: project.userId,
    isGuest,
  };
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
      /** Pre-resolved pick for the next question (loaded in parallel with suggestions). */
      nextAppablePick?: string;
      progress: { current: number; total: number };
      usage?: PublicAiUsage;
    }
  | { ok: false; error: "auth" | "project" | "cap_reached"; usage?: PublicAiUsage };

/** Record one interview answer and return the next question (or trigger build). */
export async function answerInterview(
  projectId: string,
  questionId: InterviewStepId,
  answer: string,
  prefetchedPick?: string
): Promise<AnswerInterviewResult> {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) {
    return {
      ok: false,
      error: access.reason === "missing" ? "project" : "auth",
    };
  }
  const project = access.project;
  const budget = await assertAiBudgetAvailable(project, access.isGuest);
  if (!budget.ok) {
    return { ok: false, error: "cap_reached", usage: budget.usage };
  }

  const raw =
    questionId === "colors" && !answer.trim() ? "No preference" : answer.trim();

  const step = getStepById(project.interview, questionId) ?? {
    id: questionId,
    prompt: questionId,
    kind: "text" as const,
  };

  const { result, charge } = await runWithAiBilling(
    billingScope(project, access.isGuest),
    async () => {
      const normalized = isAppablePick(raw)
        ? prefetchedPick?.trim() ||
          (await interviewResolvePick(questionId, step.prompt, project.interview)) ||
          resolveInterviewAnswer(questionId, raw, project.interview)
        : resolveInterviewAnswer(questionId, raw, project.interview);

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

      let interviewPlan = project.interviewPlan ?? null;
      if (questionId === "idea") {
        const { interviewAiPickPoolPlan } = await import("@/lib/interviewAi");
        interviewPlan = await interviewAiPickPoolPlan(interview);
      }

      await db.updateProject(projectId, {
        interview,
        ...(interviewPlan ? { interviewPlan } : {}),
      });

      const done = isInterviewDone(interview, questionId, interviewPlan);
      const nextStep = done
        ? undefined
        : resolveNextStep(interview, questionId, interviewPlan) ?? undefined;

      let acks: string[] = [];
      if (
        questionId === "colors" &&
        (isAppablePick(raw) || isDeferToRecommendation(normalized))
      ) {
        acks = [recommendColorsAck(interview)];
      } else if (isAppablePick(raw)) {
        acks = ackForAppablePick(normalized, questionId, interview);
      }

      let nextChoices:
        | { suggestions: string[]; appablePick: string }
        | undefined;
      if (nextStep) {
        const [suggestions, appablePick] = await Promise.all([
          interviewSuggestionsForStep(nextStep.id, nextStep.prompt, interview),
          interviewResolvePick(nextStep.id, nextStep.prompt, interview),
        ]);
        nextChoices = { suggestions, appablePick };
      }

      const progress = getProgress(
        interview,
        nextStep?.id ?? questionId,
        interviewPlan
      );

      return { normalized, raw, done, nextStep, acks, nextChoices, progress };
    }
  );

  if (!charge.ok) {
    return { ok: false, error: "cap_reached", usage: charge.usage };
  }

  return {
    ok: true,
    acks: result.acks,
    done: result.done,
    nextStep: result.nextStep,
    storedAnswer: result.normalized !== result.raw ? result.normalized : undefined,
    suggestions: result.nextChoices?.suggestions,
    nextAppablePick: result.nextChoices?.appablePick,
    progress: result.progress,
    usage: charge.usage,
  };
}

/** Load suggestion pills for the active question (client refresh after each step). */
export async function getInterviewSuggestions(
  projectId: string,
  stepId: InterviewStepId
): Promise<string[]> {
  const { suggestions } = await getInterviewStepChoices(projectId, stepId);
  return suggestions;
}

/** Pills + pre-resolved “Let Appable pick” answer — fetched in parallel. */
export async function getInterviewStepChoices(
  projectId: string,
  stepId: InterviewStepId
): Promise<{ suggestions: string[]; appablePick: string; usage?: PublicAiUsage }> {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) return { suggestions: [], appablePick: "" };
  const budget = await assertAiBudgetAvailable(access.project, access.isGuest);
  if (!budget.ok) return { suggestions: [], appablePick: "", usage: budget.usage };
  const step = getStepById(access.project.interview, stepId);
  if (!step) return { suggestions: [], appablePick: "" };
  const interview = access.project.interview;
  const { result, charge } = await runWithAiBilling(
    billingScope(access.project, access.isGuest),
    async () => {
      const [suggestions, appablePick] = await Promise.all([
        interviewSuggestionsForStep(step.id, step.prompt, interview),
        interviewResolvePick(step.id, step.prompt, interview),
      ]);
      return { suggestions, appablePick };
    }
  );
  if (!charge.ok) {
    return { suggestions: [], appablePick: "", usage: charge.usage };
  }
  return { ...result, usage: charge.usage };
}

/** Synthesize + store the master build prompt, mark project ready. */
export async function finishInterview(projectId: string) {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) throw new Error("NOT_FOUND");
  const project = access.project;
  const budget = await assertAiBudgetAvailable(project, access.isGuest);
  if (!budget.ok) throw new Error("AI_CAP_REACHED");

  const { result: masterPrompt } = await runWithAiBilling(
    billingScope(project, access.isGuest),
    () => generateMasterPrompt(project.interview)
  );

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
  const budget = await assertAiBudgetAvailable(project, false);
  if (!budget.ok) throw new Error("AI_CAP_REACHED");

  const { result: built } = await runWithAiBilling(
    billingScope(project, false),
    () => buildExpoAppModel(mp, projectId, undefined, project.interview)
  );
  const { model, passes } = built;
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
  const budget = await assertAiBudgetAvailable(project, false);
  if (!budget.ok) {
    return {
      ok: false,
      reason: "cap_reached",
      message: "You've used your free AI allowance.",
    };
  }

  const { result, charge } = await runWithAiBilling(
    billingScope(project, false),
    () => applyExpoTweak(project.expoAppModel!, mp, message)
  );
  if (!charge.ok) {
    return {
      ok: false,
      reason: "cap_reached",
      message: "You've used your free AI allowance.",
    };
  }

  const changed = JSON.stringify(result.model) !== JSON.stringify(project.expoAppModel);

  if (changed) {
    await db.updateProject(projectId, { expoAppModel: result.model });
    revalidatePath(`/project/${projectId}/expo`);
  }

  return { ok: true, reply: result.reply, model: result.model };
}

/** Tap-to-fix — patch one field on the preview model (scoped path). */
export async function expoSelectionTweak(
  projectId: string,
  path: string,
  action: SelectionTweakAction
): Promise<
  | { ok: true; reply: string; model: ExpoAppModel; usage: PublicAiUsage }
  | { ok: false; reason: "cap_reached" | "error"; message: string; usage?: PublicAiUsage }
> {
  const user = await requireUser();
  const project = await db.getProject(projectId);
  if (!project || project.userId !== user.id) throw new Error("NOT_FOUND");
  if (!project.masterPrompt || !project.expoAppModel) throw new Error("NO_PROMPT");

  const budget = await assertAiBudgetAvailable(project, false);
  if (!budget.ok) {
    return {
      ok: false,
      reason: "cap_reached",
      message: "You've used your free AI allowance.",
      usage: budget.usage,
    };
  }

  const mp = project.masterPrompt;
  const { result, charge } = await runWithAiBilling(
    billingScope(project, false),
    () => applySelectionTweak(project.expoAppModel!, mp, path, action)
  );

  if (!charge.ok) {
    return {
      ok: false,
      reason: "cap_reached",
      message: "You've used your free AI allowance.",
      usage: charge.usage,
    };
  }

  if (JSON.stringify(result.model) !== JSON.stringify(project.expoAppModel)) {
    await db.updateProject(projectId, { expoAppModel: result.model });
    revalidatePath(`/project/${projectId}/expo`);
  }

  return {
    ok: true,
    reply: result.reply,
    model: result.model,
    usage: charge.usage,
  };
}

/** % remaining on free AI allowance for a project (guest or signed-in). */
export async function getProjectAiUsage(projectId: string): Promise<PublicAiUsage | null> {
  const access = await resolveProjectAccess(projectId);
  if (!access.ok) return null;
  const { getAiSpentUsd } = await import("@/lib/aiBudgetAccount");
  const { publicUsageSnapshot } = await import("@/lib/aiUsage");
  const spent = await getAiSpentUsd(access.project, access.isGuest);
  return publicUsageSnapshot(spent);
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
