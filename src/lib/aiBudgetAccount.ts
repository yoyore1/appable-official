import { db } from "@/lib/db";
import { FREE_AI_BUDGET_USD, isAtAiCap, publicUsageSnapshot } from "@/lib/aiUsage";
import type { Project, UserAccount } from "@/lib/types";
import type { PublicAiUsage } from "@/lib/aiUsage";

export type ChargeBudgetResult =
  | { ok: true; spentUsd: number; usage: PublicAiUsage }
  | { ok: false; reason: "cap_reached"; usage: PublicAiUsage };

export async function getAiSpentUsd(project: Project, isGuest: boolean): Promise<number> {
  if (isGuest) return project.aiUsageUsd ?? 0;
  const user = await db.getUserById(project.userId);
  return user?.aiUsageUsd ?? 0;
}

export async function assertAiBudgetAvailable(
  project: Project,
  isGuest: boolean
): Promise<ChargeBudgetResult | { ok: true; spentUsd: number }> {
  const spentUsd = await getAiSpentUsd(project, isGuest);
  if (isAtAiCap(spentUsd)) {
    return { ok: false, reason: "cap_reached", usage: publicUsageSnapshot(spentUsd) };
  }
  return { ok: true, spentUsd };
}

async function applySpend(
  projectId: string,
  ownerUserId: string,
  isGuest: boolean,
  costUsd: number,
  ttsChars = 0
): Promise<{ spentUsd: number; user?: UserAccount }> {
  if (costUsd <= 0 && ttsChars <= 0) {
    const spent = isGuest
      ? (await db.getProject(projectId))?.aiUsageUsd ?? 0
      : (await db.getUserById(ownerUserId))?.aiUsageUsd ?? 0;
    return { spentUsd: spent };
  }

  if (isGuest) {
    const project = await db.getProject(projectId);
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    const next = Math.min(FREE_AI_BUDGET_USD, (project.aiUsageUsd ?? 0) + costUsd);
    await db.updateProject(projectId, { aiUsageUsd: next });
    return { spentUsd: next };
  }

  const user = await db.getUserById(ownerUserId);
  if (!user) throw new Error("USER_NOT_FOUND");
  const updated = await db.updateUser(ownerUserId, {
    aiUsageUsd: Math.min(FREE_AI_BUDGET_USD, user.aiUsageUsd + costUsd),
    ttsCharsUsed: user.ttsCharsUsed + ttsChars,
  });
  return { spentUsd: updated.aiUsageUsd, user: updated };
}

/** Record real provider cost against the project (guest) or user account. */
export async function chargeAiBudget(input: {
  projectId: string;
  ownerUserId: string;
  isGuest: boolean;
  costUsd: number;
  ttsChars?: number;
}): Promise<ChargeBudgetResult> {
  const { projectId, ownerUserId, isGuest, costUsd, ttsChars = 0 } = input;

  const project = await db.getProject(projectId);
  if (!project) {
    return {
      ok: false,
      reason: "cap_reached",
      usage: publicUsageSnapshot(FREE_AI_BUDGET_USD),
    };
  }

  const spentBefore = await getAiSpentUsd(project, isGuest);
  if (isAtAiCap(spentBefore)) {
    return { ok: false, reason: "cap_reached", usage: publicUsageSnapshot(spentBefore) };
  }

  if (costUsd <= 0 && ttsChars <= 0) {
    return { ok: true, spentUsd: spentBefore, usage: publicUsageSnapshot(spentBefore) };
  }

  const { spentUsd } = await applySpend(projectId, ownerUserId, isGuest, costUsd, ttsChars);
  return { ok: true, spentUsd, usage: publicUsageSnapshot(spentUsd) };
}

/** Merge guest project spend into the user when they claim after signup. */
export async function mergeGuestAiSpend(
  projectId: string,
  userId: string
): Promise<void> {
  const project = await db.getProject(projectId);
  const guestSpend = project?.aiUsageUsd ?? 0;
  if (guestSpend <= 0) return;

  const user = await db.getUserById(userId);
  if (!user) return;

  await db.updateUser(userId, {
    aiUsageUsd: Math.min(FREE_AI_BUDGET_USD, user.aiUsageUsd + guestSpend),
  });
  await db.updateProject(projectId, { aiUsageUsd: 0 });
}
