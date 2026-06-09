"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { answerInsightsQuestion } from "@/lib/insights/liveQuery";
import { pullAllInsights } from "@/lib/insights/providers";
import { runWeeklyInsightsForProject } from "@/lib/insights/runWeekly";
import {
  canRunWeeklyReports,
  reportsPhaseMessage,
} from "@/lib/insights/reportsLifecycle";
import {
  defaultInsightsState,
  type ProjectInsightsState,
} from "@/lib/insights/types";

async function ownedProject(projectId: string) {
  const user = await requireUser();
  const project = await db.getProject(projectId);
  if (!project || project.userId !== user.id) throw new Error("NOT_FOUND");
  return project;
}

export async function refreshProjectInsights(projectId: string): Promise<
  | { ok: true; state: ProjectInsightsState; snapshots: import("@/lib/insights/types").IntegrationInsightSnapshot[] }
  | { ok: false; message: string }
> {
  try {
    const project = await ownedProject(projectId);
    const snapshots = await pullAllInsights(project);
    const prior = project.insightsState ?? defaultInsightsState();
    const state: ProjectInsightsState = {
      ...prior,
      lastLivePullAt: new Date().toISOString(),
    };
    await db.updateProject(projectId, { insightsState: state });
    return { ok: true, state, snapshots };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not refresh insights",
    };
  }
}

export async function runWeeklyInsightsAction(projectId: string): Promise<
  | { ok: true; state: ProjectInsightsState }
  | { ok: false; message: string }
> {
  try {
    const project = await ownedProject(projectId);
    if (!canRunWeeklyReports(project)) {
      return { ok: false, message: reportsPhaseMessage(project) };
    }
    const { state } = await runWeeklyInsightsForProject(project);
    await db.updateProject(projectId, { insightsState: state });
    return { ok: true, state };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Weekly insights failed",
    };
  }
}

export async function expoInsightsLiveQuery(
  projectId: string,
  question: string
): Promise<
  | { ok: true; answer: string }
  | { ok: false; message: string }
> {
  const trimmed = question.trim();
  if (!trimmed) return { ok: false, message: "Empty question" };

  try {
    const project = await ownedProject(projectId);
    const { answer } = await answerInsightsQuestion(project, trimmed);
    const prior = project.insightsState ?? defaultInsightsState();
    await db.updateProject(projectId, {
      insightsState: { ...prior, lastLivePullAt: new Date().toISOString() },
    });
    return { ok: true, answer };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Live insights unavailable",
    };
  }
}

export async function patchInsightsState(
  projectId: string,
  patch: Partial<ProjectInsightsState>
): Promise<{ ok: true; state: ProjectInsightsState } | { ok: false; message: string }> {
  try {
    const project = await ownedProject(projectId);
    const next = { ...(project.insightsState ?? defaultInsightsState()), ...patch };
    await db.updateProject(projectId, { insightsState: next });
    return { ok: true, state: next };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Could not save insights settings",
    };
  }
}

export async function acknowledgeInsightsPrivacy(
  projectId: string
): Promise<{ ok: true; state: ProjectInsightsState } | { ok: false; message: string }> {
  return patchInsightsState(projectId, {
    privacyAcknowledgedAt: new Date().toISOString(),
  });
}

export async function recordInsightBuildHandoff(
  projectId: string,
  suggestionId: string
): Promise<void> {
  try {
    const project = await ownedProject(projectId);
    const prior = project.insightsState ?? defaultInsightsState();
    await db.updateProject(projectId, {
      insightsState: { ...prior, lastBuildFromInsightId: suggestionId },
    });
  } catch {
    /* non-fatal */
  }
}
