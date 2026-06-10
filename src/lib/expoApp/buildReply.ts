import type { AppliedBuildChange } from "./buildOps";

export const BUILD_DONE_REPLY = "Done.";

export const BUILD_PHONE_PENDING_NOTE =
  "Phone preview is still updating in the background — give it a few minutes.";

export const BUILD_FAILED_REPLY =
  "Couldn't apply that — tap the line or name the screen.";

/** Chat reply after a successful apply — code is saved; phone compiles async. */
export function buildAppliedChatReply(): string {
  return `${BUILD_DONE_REPLY}\n\n${BUILD_PHONE_PENDING_NOTE}`;
}

/** Cursor-style: applied = done + phone note; failed = one short line. */
export function formatHonestBuildReply(applied: AppliedBuildChange[]): string {
  return applied.length ? buildAppliedChatReply() : BUILD_FAILED_REPLY;
}
