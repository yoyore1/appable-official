import type { UserAccount } from "@/lib/types";

/** True when the user has any paid publishing tier (usage pack or course subscription). */
export function hasPaidPublishingTier(
  user: Pick<UserAccount, "courseTierId" | "usagePackPurchased">
): boolean {
  return Boolean(user.courseTierId) || Boolean(user.usagePackPurchased);
}

/** Free-tier apps show the "Made with Appable" watermark until they upgrade. */
export function shouldShowAppableWatermark(
  user: Pick<UserAccount, "courseTierId" | "usagePackPurchased"> | null | undefined
): boolean {
  if (!user) return true;
  return !hasPaidPublishingTier(user);
}
