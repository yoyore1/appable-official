import { db } from "@/lib/db";
import { FREE_AI_BUDGET_USD, publicUsageSnapshot, type PublicAiUsage } from "@/lib/aiUsage";
import type { UserAccount } from "@/lib/types";

/** Record real provider USD against the user's free AI budget (and TTS char cap). */
export async function recordAiSpend(
  userId: string,
  costUsd: number,
  ttsChars = 0
): Promise<UserAccount> {
  if (costUsd <= 0 && ttsChars <= 0) {
    const user = await db.getUserById(userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    return user;
  }
  const user = await db.getUserById(userId);
  if (!user) throw new Error("USER_NOT_FOUND");
  return db.updateUser(userId, {
    aiUsageUsd: Math.min(FREE_AI_BUDGET_USD, user.aiUsageUsd + costUsd),
    ttsCharsUsed: user.ttsCharsUsed + ttsChars,
  });
}

export function publicUsageForUser(
  user: Pick<UserAccount, "aiUsageUsd">
): PublicAiUsage {
  return publicUsageSnapshot(user.aiUsageUsd);
}
