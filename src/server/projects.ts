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
import { integrations } from "@/lib/config";
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
  appendBrainstormTurn,
  defaultBrainstormState,
  formatBrainstormContextForBuild,
  summarizeReadinessForBuild,
  truncateBrainstormHistory,
} from "@/lib/expoApp/brainstormContext";
import { runBrainstormChat } from "@/lib/expoApp/brainstormChat";
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
      const engineerPlan = await interviewAiPickPoolPlan(interview);
      if (engineerPlan.length) {
        await db.updateProject(project.id, { interviewPlan: engineerPlan });
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
        acks = await ackForAppablePick(normalized, questionId, interview);
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
  let { model, passes } = built;

  setBuildProgress(projectId, {
    stepId: "scaffold",
    label: `Writing real Expo Router app for ${mp.appName}…`,
    index: 5,
    total: 9,
    percent: 68,
  });

  const {
    ensureProjectWorkspace,
    assertWorkspaceScaffolded,
    loadModelFromWorkspace,
    listWorkspaceFiles,
    readWorkspaceFile,
  } = await import("@/lib/codeAgent/workspace");
  const { runInitialCodegen } = await import("@/lib/codeAgent/initialCodegen");
  const { coerceExpoAppModel } = await import("@/lib/expoApp/coerceModel");
  const { ensureRepoForApp, commitAppState } = await import("@/lib/github");

  await ensureProjectWorkspace({
    projectId,
    model,
    appName: mp.appName,
    userId: user.id,
    masterPrompt: mp,
    scaffoldApp: true,
  });
  await assertWorkspaceScaffolded(projectId);

  const canRunInitialAgent =
    integrations.codeAgent &&
    (integrations.expoBuildModel || integrations.planModel);

  if (canRunInitialAgent) {
    setBuildProgress(projectId, {
      stepId: "codegen",
      label: `Code agent finishing ${mp.appName} (React Native screens)…`,
      index: 7,
      total: 9,
      percent: 82,
    });
    await runWithAiBilling(billingScope(project, false), () =>
      runInitialCodegen({ projectId, model, mp })
    );
    model = coerceExpoAppModel((await loadModelFromWorkspace(projectId)) ?? model);
  } else {
    setBuildProgress(projectId, {
      stepId: "codegen",
      label: `Expo app scaffold ready — add FIREWORKS_API_KEY for agent polish…`,
      index: 7,
      total: 9,
      percent: 82,
    });
  }

  model = coerceExpoAppModel(model);

  const repoUrl = await ensureRepoForApp({
    userId: user.id,
    name: mp.appName,
    githubRepoUrl: project.githubRepoUrl ?? null,
  });

  if (repoUrl && integrations.github) {
    try {
      const files = await listWorkspaceFiles(projectId);
      const payload: { path: string; contents: string }[] = [];
      for (const rel of files) {
        payload.push({
          path: rel,
          contents: await readWorkspaceFile(projectId, rel),
        });
      }
      if (payload.length) {
        await commitAppState(repoUrl, payload, `Initial build: ${mp.appName}`);
      }
    } catch {
      /* github optional */
    }
  }

  const { mintExpoPreviewToken } = await import("@/lib/expoPreviewToken");
  await db.updateProject(projectId, {
    expoAppModel: model,
    expoPreviewToken: mintExpoPreviewToken(),
    target: "rn",
    status: "live",
    githubRepoUrl: repoUrl ?? project.githubRepoUrl,
  });

  setBuildProgress(projectId, {
    stepId: "runtime",
    label: `Setting up ${mp.appName} — installing, self-checking, and compiling…`,
    index: 8,
    total: 9,
    percent: 92,
  });

  // Self-healing: repair package.json → npm install → web compile → Metro.
  // Best-effort: the app + model are already saved, so a slow/failed first
  // compile must not throw away the build. The preview polls until ready.
  const { bootstrapWorkspaceRuntime } = await import(
    "@/lib/codeAgent/workspaceRuntime"
  );
  try {
    bootstrapWorkspaceRuntime(projectId);
  } catch (err) {
    console.error("[expo build] runtime bootstrap failed:", err);
  }

  revalidatePath(`/project/${projectId}`);
  setTimeout(() => clearBuildProgress(projectId), 60_000);
  return { model, passes };
}

/** Post-build brainstorm — Qwen coach, Kimi on deep threads; no preview changes from chat itself. */
export async function expoBrainstormChat(
  projectId: string,
  message: string,
  pinnedItemId?: string | null,
  editFromTurnIndex?: number | null,
  attachments?: import("@/lib/types").ChatAttachmentUpload[],
  previewState?: import("@/lib/expoApp/previewBuildState").PreviewBuildState
): Promise<
  | {
      ok: true;
      reply: string;
      buildSuggestion: import("@/lib/types").BrainstormBuildSuggestion | null;
      brainstormState: import("@/lib/types").ProjectBrainstormState;
    }
  | { ok: false; message: string }
> {
  try {
    const user = await requireUser();
    const project = await db.getProject(projectId);
    if (!project || project.userId !== user.id) {
      return { ok: false, message: "Project not found." };
    }
    if (!project.masterPrompt) {
      return { ok: false, message: "Finish setup before brainstorming." };
    }

    const previewModel = project.expoAppModel ?? null;
    const interview = project.interview ?? [];
    const priorBase = project.brainstormState ?? defaultBrainstormState();
    const prior =
      typeof editFromTurnIndex === "number" && editFromTurnIndex >= 0
        ? truncateBrainstormHistory(priorBase, editFromTurnIndex)
        : priorBase;
    const { auditAppReadiness, enrichAuditWithState } = await import(
      "@/lib/expoApp/readinessAudit"
    );
    const { applyConnectorsToAudit } = await import("@/lib/connectors/readinessConnector");
    const { enrichOAuthSetupStatus } = await import("@/lib/expoApp/oauthReadiness");
    const audit =
      previewModel != null
        ? enrichOAuthSetupStatus(
            applyConnectorsToAudit(
              enrichAuditWithState(
                auditAppReadiness(previewModel, project.masterPrompt, interview),
                project.readinessState,
                pinnedItemId
              ),
              project.supabaseConnector?.public,
              project.revenueCatConnector?.public,
              project.railwayConnector?.public
            ),
            Boolean(previewModel.flow?.auth?.enabled),
            project.readinessState
          )
        : null;
    const pinnedItem =
      pinnedItemId && audit
        ? audit.items.find((i) => i.id === pinnedItemId) ?? null
        : null;

    const {
      formatConnectorContextForCoach,
      mergeConnectorNeeds,
      projectConnectorState,
      suggestConnectors,
    } = await import("@/lib/connectors/registry");
    const connectorState = projectConnectorState(project);
    const connectorSuggestions = mergeConnectorNeeds(
      suggestConnectors({
        mp: project.masterPrompt,
        interview,
        audit,
      }),
      message
    );
    const connectorNote = formatConnectorContextForCoach(
      connectorState,
      connectorSuggestions,
      audit,
      project.marketplaceSelections ?? [],
      project.masterPrompt.appName
    );

    const displayText = message.trim();
    if (!displayText && !attachments?.length) {
      return { ok: false, message: "Type a message or attach a photo." };
    }

    let effectiveMessage = displayText;
    let storedAttachments: import("@/lib/types").ChatAttachmentRef[] | undefined;

    if (attachments?.length) {
      const { analyzeChatAttachments } = await import("@/lib/expoApp/analyzeChatAttachments");
      const analyzed = await analyzeChatAttachments(attachments, displayText, {
        appName: project.masterPrompt.appName,
        mode: "brainstorm",
      });
      effectiveMessage = analyzed.effectiveMessage;
      storedAttachments = analyzed.storedAttachments;
    }

    const { enrichBrainstormUserMessage } = await import("@/lib/expoApp/brainstormContext");
    const coachMessage = enrichBrainstormUserMessage(
      effectiveMessage,
      prior.history,
      pinnedItem
        ? { title: pinnedItem.title, plainWhy: pinnedItem.plainWhy }
        : null
    );

    const result = await runBrainstormChat(
      project.masterPrompt,
      prior.history,
      coachMessage,
      {
        model: previewModel,
        interview,
        audit,
        pinnedItem,
        existingSummary: prior.summary,
        connectorNote,
        previewState,
        hasAttachments: Boolean(attachments?.length),
      }
    );

    const brainstormState = {
      ...appendBrainstormTurn(prior, effectiveMessage, result.reply, {
        displayText: displayText || undefined,
        attachments: storedAttachments,
      }),
      summary: result.summary,
      pendingBuild: result.buildSuggestion ?? null,
    };

    await db.updateProject(projectId, { brainstormState });

    return {
      ok: true,
      reply: result.reply,
      buildSuggestion: brainstormState.pendingBuild ?? null,
      brainstormState,
    };
  } catch (err) {
    console.error("[expoBrainstormChat]", err);
    return { ok: false, message: "Brainstorm hit a snag — try again." };
  }
}

/** Deep research brief when founder discusses an integration in brainstorm. */
export async function expoIntegrationDeepDive(
  projectId: string,
  integrationId: import("@/lib/connectors/catalog").ConnectorId,
  pinnedItemId?: string | null
): Promise<
  | {
      ok: true;
      reply: string;
      brainstormState: import("@/lib/types").ProjectBrainstormState;
    }
  | { ok: false; message: string }
> {
  const user = await requireUser();
  const project = await db.getProject(projectId);
  if (!project || project.userId !== user.id) throw new Error("NOT_FOUND");
  if (!project.masterPrompt) throw new Error("NO_PROMPT");

  try {
    const previewModel = project.expoAppModel ?? null;
    const interview = project.interview ?? [];
    const prior = project.brainstormState ?? defaultBrainstormState();
    const { auditAppReadiness, enrichAuditWithState } = await import(
      "@/lib/expoApp/readinessAudit"
    );
    const { applyConnectorsToAudit } = await import("@/lib/connectors/readinessConnector");
    const { enrichOAuthSetupStatus } = await import("@/lib/expoApp/oauthReadiness");
    const audit =
      previewModel != null
        ? enrichOAuthSetupStatus(
            applyConnectorsToAudit(
              enrichAuditWithState(
                auditAppReadiness(previewModel, project.masterPrompt, interview),
                project.readinessState,
                pinnedItemId
              ),
              project.supabaseConnector?.public,
              project.revenueCatConnector?.public,
              project.railwayConnector?.public
            ),
            Boolean(previewModel.flow?.auth?.enabled),
            project.readinessState
          )
        : null;
    const pinnedItem =
      pinnedItemId && audit
        ? audit.items.find((i) => i.id === pinnedItemId) ?? null
        : null;

    const {
      formatConnectorContextForCoach,
      mergeConnectorNeeds,
      projectConnectorState,
      suggestConnectors,
    } = await import("@/lib/connectors/registry");
    const { resolveIntegrationBrief } = await import("@/lib/connectors/integrationBrief");
    const { runIntegrationDeepDive } = await import(
      "@/lib/connectors/integrationBriefServer"
    );
    const { getConnectorDefinition } = await import("@/lib/connectors/registry");
    const { founderIntegrationBriefHint } = await import("@/lib/expoApp/founderVoice");

    const brief =
      resolveIntegrationBrief({
        history: prior.history,
        pinnedIntegrationId: integrationId,
        appName: project.masterPrompt.appName,
      }) ?? {
        integrationId,
        label: `Full ${getConnectorDefinition(integrationId).displayName} brief`,
        hint: founderIntegrationBriefHint(project.masterPrompt.appName),
        userMessage: `[Full integration brief · ${getConnectorDefinition(integrationId).displayName}] Research this deeply for ${project.masterPrompt.appName}.`,
      };

    const connectorState = projectConnectorState(project);
    const connectorSuggestions = mergeConnectorNeeds(
      suggestConnectors({
        mp: project.masterPrompt,
        interview,
        audit,
      }),
      brief.userMessage
    );
    const connectorNote = formatConnectorContextForCoach(
      connectorState,
      connectorSuggestions,
      audit,
      project.marketplaceSelections ?? [],
      project.masterPrompt.appName
    );

    const result = await runIntegrationDeepDive(
      project.masterPrompt,
      prior.history,
      integrationId,
      brief.userMessage,
      {
        model: previewModel,
        interview,
        audit,
        pinnedItem,
        existingSummary: prior.summary,
        connectorNote,
      }
    );

    const brainstormState = {
      ...appendBrainstormTurn(prior, brief.userMessage, result.reply),
      summary: result.summary,
    };

    await db.updateProject(projectId, { brainstormState });

    return { ok: true, reply: result.reply, brainstormState };
  } catch {
    return { ok: false, message: "Research brief hit a snag — try again." };
  }
}

/** Clear pending build handoff after user switches to Build. */
export async function clearBrainstormBuildSuggestion(
  projectId: string
): Promise<{ ok: true; brainstormState: import("@/lib/types").ProjectBrainstormState }> {
  const user = await requireUser();
  const project = await db.getProject(projectId);
  if (!project || project.userId !== user.id) throw new Error("NOT_FOUND");

  const prior = project.brainstormState ?? defaultBrainstormState();
  const brainstormState = { ...prior, pendingBuild: null };
  await db.updateProject(projectId, { brainstormState });
  revalidatePath(`/project/${projectId}/expo`);
  return { ok: true, brainstormState };
}

/** Persist launch-checklist progress (discussed / yes / later / skip). */
export async function patchProjectReadiness(
  projectId: string,
  update: {
    pinnedItemId?: string | null;
    itemId?: string;
    discussed?: boolean;
    decision?: import("@/lib/types").ReadinessDecision | null;
  }
): Promise<{ ok: true; state: import("@/lib/types").ProjectReadinessState }> {
  const user = await requireUser();
  const project = await db.getProject(projectId);
  if (!project || project.userId !== user.id) throw new Error("NOT_FOUND");

  const { defaultReadinessState, patchReadinessItem } = await import(
    "@/lib/expoApp/readinessAudit"
  );
  let state = project.readinessState ?? defaultReadinessState();

  if (update.pinnedItemId !== undefined) {
    state = { ...state, pinnedItemId: update.pinnedItemId };
  }

  if (update.itemId) {
    state = patchReadinessItem(state, update.itemId, {
      ...(update.discussed !== undefined ? { discussed: update.discussed } : {}),
      ...(update.decision !== undefined ? { decision: update.decision } : {}),
    });
  }

  state = { ...state, lastAuditAt: new Date().toISOString() };
  await db.updateProject(projectId, { readinessState: state });
  revalidatePath(`/project/${projectId}/expo`);
  return { ok: true, state };
}

/** Post-build tweak chat — cheap model, counts against $0.55 AI cap. */
export async function expoTweakChat(
  projectId: string,
  message: string,
  attachments?: import("@/lib/types").ChatAttachmentUpload[],
  patches?: import("@/lib/types").BuildPatchOp[],
  previewState?: import("@/lib/expoApp/previewBuildState").PreviewBuildState,
  fromBrainstormApply?: boolean
): Promise<
  | {
      ok: true;
      reply: string;
      model: ExpoAppModel;
      buildState: import("@/lib/types").ProjectBuildState;
    }
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

  const { auditAppReadiness } = await import("@/lib/expoApp/readinessAudit");
  const audit = auditAppReadiness(
    project.expoAppModel!,
    mp,
    project.interview ?? []
  );
  const readinessNote = summarizeReadinessForBuild(
    audit.items,
    project.readinessState
  );
  const {
    formatConnectorContextForCoach,
    mergeConnectorNeeds,
    projectConnectorState,
    suggestConnectors,
  } = await import("@/lib/connectors/registry");
  const connectorState = projectConnectorState(project);
  const connectorSuggestions = mergeConnectorNeeds(
    suggestConnectors({
      mp,
      interview: project.interview ?? [],
      audit,
    }),
    message
  );
  const brainstormContext = formatBrainstormContextForBuild(
    project.brainstormState,
    readinessNote,
    formatConnectorContextForCoach(
      connectorState,
      connectorSuggestions,
      audit,
      project.marketplaceSelections ?? [],
      mp.appName
    ),
    project.expoAppModel
  );

  const displayText = message.trim();
  if (!displayText && !attachments?.length) {
    return {
      ok: false,
      reason: "error",
      message: "Type a message or attach a photo.",
    };
  }

  let result: Awaited<ReturnType<typeof applyExpoTweak>>;
  let charge: Awaited<ReturnType<typeof runWithAiBilling<typeof result>>>["charge"];
  try {
    const run = await runWithAiBilling(billingScope(project, false), async () => {
      let effectiveMessage = displayText;
      if (attachments?.length) {
        const { analyzeChatAttachments } = await import("@/lib/expoApp/analyzeChatAttachments");
        const analyzed = await analyzeChatAttachments(attachments, displayText, {
          appName: mp.appName,
          mode: "build",
        });
        effectiveMessage = analyzed.effectiveMessage;
      }
      const { compileBuildHandoff } = await import("@/lib/expoApp/compileBuildHandoff");
      const buildHistory = project.buildState?.history ?? [];
      const compiled = compileBuildHandoff({
        history: project.brainstormState?.history ?? [],
        model: project.expoAppModel!,
        appName: mp.appName,
        userMessage: displayText,
        pendingBuild: project.brainstormState?.pendingBuild,
        brainstormContext,
        buildHistory,
      });
      const buildPatches =
        patches?.length ? patches : compiled.patches.length ? compiled.patches : undefined;

      return applyExpoTweak(
        project.expoAppModel!,
        mp,
        buildPatches?.length ? compiled.applyPrompt : effectiveMessage,
        {
        projectId,
        brainstormContext,
        brainstormSummary: project.brainstormState?.summary,
        brainstormHistory: project.brainstormState?.history ?? [],
        buildHistory,
        compiledHandoff: compiled,
        buildPatches,
        pendingBuild: project.brainstormState?.pendingBuild,
        interview: project.interview ?? [],
        connectorState,
        connectorNeeds: connectorSuggestions,
        marketplaceSelections: project.marketplaceSelections ?? [],
        applyMessagingSchema: async (id) => {
          const { applyMessagingSchemaToProject } = await import("@/server/connectors");
          return applyMessagingSchemaToProject(id);
        },
        previewState,
        userId: user.id,
        githubRepoUrl: project.githubRepoUrl,
        fromBrainstormApply: Boolean(fromBrainstormApply),
      });
    });
    result = run.result;
    charge = run.charge;
  } catch (err) {
    console.error("[expoTweakChat]", err);
    return {
      ok: false,
      reason: "error",
      message: "Build hit a snag — try again.",
    };
  }

  if (!charge.ok) {
    return {
      ok: false,
      reason: "cap_reached",
      message: "You've used your free AI allowance.",
    };
  }

  const changed = JSON.stringify(result.model) !== JSON.stringify(project.expoAppModel);

  const { appendBuildTurn, defaultBuildState } = await import(
    "@/lib/expoApp/buildChatContext"
  );
  const priorBuild = project.buildState ?? defaultBuildState();
  const buildState = appendBuildTurn(priorBuild, displayText, result.reply);

  if (changed) {
    await db.updateProject(projectId, { expoAppModel: result.model, buildState });
    const { bootstrapWorkspaceRuntime } = await import(
      "@/lib/codeAgent/workspaceRuntime"
    );
    bootstrapWorkspaceRuntime(projectId);
    revalidatePath(`/project/${projectId}/expo`);
  } else {
    await db.updateProject(projectId, { buildState });
  }

  return { ok: true, reply: result.reply, model: result.model, buildState };
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
    () =>
      applySelectionTweak(
        project.expoAppModel!,
        mp,
        path,
        action,
        project.interview ?? []
      )
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

/** Tap-to-edit — persist a single text/color/background change into the real app. */
export async function expoTapEdit(
  projectId: string,
  target: import("@/lib/expoApp/applyTapEdit").TapEditTarget,
  change: import("@/lib/expoApp/applyTapEdit").TapEditChange
): Promise<
  | { ok: true; model: ExpoAppModel }
  | { ok: false; message: string }
> {
  const user = await requireUser();
  const project = await db.getProject(projectId);
  if (!project || project.userId !== user.id) {
    return { ok: false, message: "Project not found." };
  }
  if (!project.expoAppModel) {
    return { ok: false, message: "Build your app first." };
  }

  const { applyTapEdit } = await import("@/lib/expoApp/applyTapEdit");
  const { model: next, changed } = applyTapEdit(
    project.expoAppModel,
    target,
    change
  );
  if (!changed) return { ok: true, model: project.expoAppModel };

  await db.updateProject(projectId, { expoAppModel: next });

  // Push the change into the real workspace and recompile the web build.
  try {
    const { syncModelToWorkspace } = await import("@/lib/codeAgent/workspace");
    await syncModelToWorkspace(projectId, next);
    const { bootstrapWorkspaceRuntime } = await import(
      "@/lib/codeAgent/workspaceRuntime"
    );
    bootstrapWorkspaceRuntime(projectId);
  } catch {
    /* preview recompile is best-effort */
  }

  revalidatePath(`/project/${projectId}/expo`);
  return { ok: true, model: next };
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

/** Queue EAS cloud build (preview or production). */
export async function triggerEasPublish(
  projectId: string,
  profile: "preview" | "production" | "development" = "preview"
): Promise<{ ok: true; message: string } | { ok: false; message: string; setup?: string }> {
  const user = await requireUser();
  const project = await db.getProject(projectId);
  if (!project || project.userId !== user.id) throw new Error("NOT_FOUND");
  if (!project.expoAppModel || !project.masterPrompt) {
    return { ok: false, message: "Finish your app build before publishing." };
  }

  const { ensureProjectWorkspace, syncModelToWorkspace } = await import(
    "@/lib/codeAgent/workspace"
  );
  const { triggerEasBuild } = await import("@/lib/eas/triggerEasBuild");

  await ensureProjectWorkspace({
    projectId,
    model: project.expoAppModel,
    appName: project.masterPrompt.appName,
    userId: user.id,
    masterPrompt: project.masterPrompt,
    scaffoldApp: true,
  });
  await syncModelToWorkspace(projectId, project.expoAppModel);

  const result = await triggerEasBuild(projectId, profile, "all");
  if (!result.ok) {
    return { ok: false, message: result.message, setup: result.setup };
  }
  return { ok: true, message: result.message };
}
