import type { BrainstormTurn, InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import {
  inferBuildTaskFromContext,
  isBuildExecutionMessage,
  isVagueBuildFollowUp,
} from "../resolveBuildIntent";
import { detectRequiredCapabilities } from "./registry";
import type { CapabilityId } from "./types";

/** Full app | scoped capability list | skip review (cosmetic tweak). */
export type BuildReviewScope = CapabilityId[] | "skip";

const IMPLICIT_DEPS: Partial<Record<CapabilityId, CapabilityId[]>> = {
  messaging: ["status_workflow"],
  marketplace_match: ["status_workflow"],
  booking: ["status_workflow"],
  commerce: ["collection", "content_browse"],
  social_feed: ["content_browse"],
  live_tracking: ["status_workflow"],
  payments: ["commerce"],
};

function recentBlob(history: BrainstormTurn[], context?: string, maxTurns = 8): string {
  return `${history
    .slice(-maxTurns)
    .map((t) => t.content)
    .join("\n")}\n${context ?? ""}`.toLowerCase();
}

function capabilitiesFromText(text: string): CapabilityId[] {
  const out = new Set<CapabilityId>();
  const add = (id: CapabilityId) => out.add(id);

  if (/messag|chat|inbox|conversation|reply|thread|dm\b/.test(text)) add("messaging");
  if (
    /sign[\s-]?up|sign[\s-]?in|auth|login|register|supabase|google login|apple login/.test(text)
  ) {
    add("auth_accounts");
  }
  if (/sign[\s-]?out|delete account|account controls/.test(text)) add("auth_accounts");
  if (/cart|checkout|shop|product|\bbuy\b|store|add to cart/.test(text)) add("commerce");
  if (/book|schedule|appointment|reserve|slot|calendar|availability/.test(text)) add("booking");
  if (/map|gps|track|live location|en route|on the way|nearby pin/.test(text)) {
    add("live_tracking");
  }
  if (/feed|post\b|social|follow|timeline/.test(text)) add("social_feed");
  if (/habit|streak|daily check|check.?in/.test(text)) add("habit_streak");
  if (/note|journal|memo/.test(text)) add("journal");
  if (/pay|subscribe|premium|paywall|checkout/.test(text)) add("payments");
  if (/owner|walker|buyer|seller|dual.?role|two sides|both sides|role picker/.test(text)) {
    add("dual_roles");
  }
  if (/marketplace|match|apply to|walk request|post a request|gig|hire|applicant/.test(text)) {
    add("marketplace_match");
  }
  if (/save|favorite|bookmark|grocery|shopping list|collection|add to list/.test(text)) {
    add("collection");
  }
  if (/recipe|lesson|workout|detail|browse|library|content|ingredient|step/.test(text)) {
    add("content_browse");
  }
  if (/status|accept|complete walk|apply|confirm|badge|in progress/.test(text)) {
    add("status_workflow");
  }

  return [...out];
}

function isCosmeticOnly(message: string): boolean {
  const m = message.toLowerCase().trim();
  if (
    /messag|auth|cart|book|wire|tab|sign[\s-]?|pay|map|role|shop|feed|habit|note|marketplace|apply|complete/.test(
      m
    )
  ) {
    return false;
  }
  return /headline|subheadline|accent|color|palette|font|copy|rename|shorter|longer|title|vibe|hero/.test(
    m
  );
}

/** Add capabilities required to complete the ones the user asked for. */
export function expandCapabilityScope(
  primary: CapabilityId[],
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): CapabilityId[] {
  const appRequired = new Set(detectRequiredCapabilities(mp, interview));
  const out = new Set<CapabilityId>();

  for (const id of primary) {
    if (appRequired.has(id)) out.add(id);
    for (const dep of IMPLICIT_DEPS[id] ?? []) {
      if (appRequired.has(dep)) out.add(dep);
    }
  }

  if (out.has("messaging") && appRequired.has("dual_roles")) out.add("dual_roles");
  if (out.has("marketplace_match") && appRequired.has("dual_roles")) out.add("dual_roles");
  if (out.has("messaging") && appRequired.has("marketplace_match")) out.add("marketplace_match");

  return [...out];
}

/**
 * What to review after a Build tweak — requested feature(s) + implicit deps only.
 * Returns "skip" for cosmetic copy/color tweaks.
 */
export function inferBuildReviewScope(
  message: string,
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = [],
  history: BrainstormTurn[] = [],
  context?: string
): BuildReviewScope {
  const trimmed = message.trim();
  const blob = `${trimmed.toLowerCase()}\n${recentBlob(history, context)}`;

  if (isCosmeticOnly(trimmed)) return "skip";

  let primary = capabilitiesFromText(blob);

  if (primary.length === 0 && (isVagueBuildFollowUp(trimmed) || isBuildExecutionMessage(trimmed))) {
    const task = inferBuildTaskFromContext(history, context);
    if (task === "messaging") primary = ["messaging"];
    else if (task === "auth" || task === "sign_out") primary = ["auth_accounts"];
  }

  if (primary.length === 0) return "skip";

  return expandCapabilityScope(primary, mp, interview);
}

/** Global preview-action checks only when scoped caps use primary buttons. */
export function scopeNeedsActionPlan(scope: CapabilityId[]): boolean {
  return scope.some((id) =>
    [
      "messaging",
      "status_workflow",
      "booking",
      "commerce",
      "marketplace_match",
      "social_feed",
      "habit_streak",
    ].includes(id)
  );
}
