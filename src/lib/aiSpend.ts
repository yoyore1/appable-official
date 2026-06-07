import { db } from "@/lib/db";
import type { UserAccount } from "@/lib/types";

/** Record spend against the user's free AI budget (and TTS char cap). */
export async function recordAiSpend(
  userId: string,
  costUsd: number,
  ttsChars = 0
): Promise<UserAccount> {
  const user = await db.getUserById(userId);
  if (!user) throw new Error("USER_NOT_FOUND");
  return db.updateUser(userId, {
    aiUsageUsd: user.aiUsageUsd + costUsd,
    ttsCharsUsed: user.ttsCharsUsed + ttsChars,
  });
}
