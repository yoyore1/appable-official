import { LAYOUT_ARCHETYPES, type LayoutArchetype } from "@/lib/archetypes";
import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import { buildInterviewContext } from "../interviewContext";
import { inferProductSpec } from "../productSpec";
import type { AppShape } from "../nicheSignatures";
import {
  archetypeIsKnown,
  capabilitiesFromInterviewBlob,
  pruneRequiredCapabilities,
} from "./capabilityPolicy";
import type { CapabilityId } from "./types";

const ARCHETYPE_CAPABILITIES: Record<LayoutArchetype, CapabilityId[]> = {
  "tracker-dashboard": ["content_browse", "status_workflow"],
  "swipe-cards": ["messaging", "status_workflow"],
  "social-feed": ["social_feed", "content_browse", "collection"],
  "chat-messaging": ["messaging"],
  "marketplace-shop": ["commerce", "collection"],
  "booking-scheduling": ["booking", "status_workflow", "messaging"],
  "content-library": ["content_browse", "collection"],
  "habit-streak": ["habit_streak", "status_workflow"],
  "journal-notes": ["journal", "content_browse"],
  "onboarding-heavy-utility": ["content_browse"],
};

const SHAPE_CAPABILITIES: Record<AppShape, CapabilityId[]> = {
  local_marketplace: [
    "marketplace_match",
    "dual_roles",
    "messaging",
    "status_workflow",
    "live_tracking",
  ],
  live_tracking: ["live_tracking", "status_workflow"],
  booking: ["booking", "status_workflow", "messaging"],
  delivery: ["live_tracking", "status_workflow", "messaging"],
  content_library: ["content_browse", "collection"],
  habit_streak: ["habit_streak", "status_workflow"],
  finance: ["content_browse", "payments", "status_workflow"],
  travel: ["booking", "content_browse", "collection"],
  dating_match: ["messaging", "status_workflow"],
  health_medical: ["booking", "content_browse", "status_workflow"],
  real_estate: ["commerce", "content_browse", "messaging"],
  events: ["booking", "status_workflow"],
  job_gig: ["marketplace_match", "messaging", "status_workflow"],
  parenting: ["content_browse", "habit_streak"],
  automotive: ["commerce", "live_tracking"],
  outdoor_trails: ["content_browse", "live_tracking"],
  alarm_safety: ["live_tracking", "status_workflow"],
  language_learn: ["content_browse", "habit_streak", "collection"],
  wellness_mind: ["habit_streak", "content_browse"],
  inventory_smb: ["commerce", "status_workflow"],
  community_forum: ["social_feed", "messaging"],
  music_audio: ["content_browse", "collection"],
  photo_social: ["social_feed", "collection"],
  crypto_portfolio: ["content_browse", "payments"],
  notes_docs: ["journal", "content_browse"],
};

function blobFrom(mp: MasterBuildPrompt, interview: InterviewTurn[]): string {
  return buildInterviewContext(mp, interview).transcript.toLowerCase();
}

function inferLayoutArchetype(blob: string, stored?: string): LayoutArchetype {
  const fromStored = stored?.trim() as LayoutArchetype | undefined;
  if (fromStored && archetypeIsKnown(fromStored)) return fromStored;

  let best: LayoutArchetype = "onboarding-heavy-utility";
  let bestScore = 0;
  for (const [id, def] of Object.entries(LAYOUT_ARCHETYPES) as [
    LayoutArchetype,
    (typeof LAYOUT_ARCHETYPES)[LayoutArchetype],
  ][]) {
    if (def.matchKeywords.test(blob)) {
      const score = 2;
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
  }
  return best;
}

/** Category-native core — sensible extras for this app type, not a feature buffet. */
function addCategoryCore(
  required: Set<CapabilityId>,
  category: ReturnType<typeof buildInterviewContext>["category"]
): void {
  if (category === "pets") {
    required.add("marketplace_match");
    required.add("dual_roles");
    required.add("messaging");
    required.add("live_tracking");
    required.add("status_workflow");
    required.add("content_browse");
  }
  if (category === "cooking") {
    required.add("content_browse");
    required.add("collection");
  }
  if (category === "shopping") {
    required.add("commerce");
    required.add("collection");
    required.add("content_browse");
  }
  if (category === "fitness") {
    required.add("content_browse");
    required.add("status_workflow");
  }
  if (category === "social") {
    required.add("social_feed");
    required.add("messaging");
    required.add("content_browse");
  }
  if (category === "education") {
    required.add("content_browse");
    required.add("collection");
  }
  if (category === "productivity") {
    required.add("content_browse");
    required.add("collection");
    required.add("status_workflow");
  }
}

/** Which capabilities this app must satisfy in preview (deterministic). */
export function detectRequiredCapabilities(
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): CapabilityId[] {
  const ctx = buildInterviewContext(mp, interview);
  const blob = blobFrom(mp, interview);
  const spec = inferProductSpec(mp, interview);
  const archetype = inferLayoutArchetype(blob, mp.layoutArchetype);

  const required = new Set<CapabilityId>();

  for (const id of ARCHETYPE_CAPABILITIES[archetype]) required.add(id);

  // Top shapes only — avoid bleeding unrelated product shapes into one app.
  for (const shape of ctx.appShapes.slice(0, 2)) {
    for (const id of SHAPE_CAPABILITIES[shape as AppShape] ?? []) required.add(id);
  }

  for (const id of capabilitiesFromInterviewBlob(blob)) required.add(id);
  for (const f of mp.features) {
    for (const id of capabilitiesFromInterviewBlob(f.toLowerCase())) required.add(id);
  }

  if (spec.hasDualRoles) {
    required.add("dual_roles");
    required.add("status_workflow");
    if (!required.has("messaging")) required.add("messaging");
  }

  addCategoryCore(required, ctx.category);

  for (const essential of ctx.essentialFeatures) {
    for (const id of capabilitiesFromInterviewBlob(essential.toLowerCase())) required.add(id);
  }

  // List/detail cards — required when marketplace or browse-heavy, not universal junk.
  if (
    required.has("marketplace_match") ||
    required.has("content_browse") ||
    archetype === "content-library" ||
    ctx.category === "cooking"
  ) {
    required.add("content_browse");
  }

  pruneRequiredCapabilities(required, ctx, archetype, blob);

  return [...required];
}

export function capabilityLabel(id: CapabilityId): string {
  const labels: Record<CapabilityId, string> = {
    auth_accounts: "Sign in & accounts",
    dual_roles: "Two user roles",
    content_browse: "Browse & detail content",
    collection: "Save & collections",
    messaging: "In-app messaging",
    marketplace_match: "Post & match marketplace",
    status_workflow: "Status updates (apply/book/complete)",
    booking: "Booking & scheduling",
    commerce: "Shop & cart",
    social_feed: "Social feed",
    live_tracking: "Live map & tracking",
    payments: "Payments & subscriptions",
    habit_streak: "Habits & streaks",
    journal: "Notes & journal",
  };
  return labels[id];
}
