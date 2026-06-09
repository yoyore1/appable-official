import { LAYOUT_ARCHETYPES, type LayoutArchetype } from "@/lib/archetypes";
import type { InterviewBuildContext } from "../interviewContext";
import type { AppShape } from "../nicheSignatures";
import type { AppCategory } from "../inferCategory";
import type { CapabilityId } from "./types";

/** User clearly asked for this capability (escape hatch for blocklists). */
export function userExplicitlyWantsCapability(
  capability: CapabilityId,
  blob: string
): boolean {
  const b = blob.toLowerCase();
  const tests: Partial<Record<CapabilityId, RegExp>> = {
    commerce:
      /\b(shop|online store|e-?commerce|sell products|merch|product catalog|shopping cart|add to cart|buy (now|items|products)|storefront)\b/,
    social_feed:
      /\b(social feed|news feed|timeline|followers?|following|post to feed|feed of posts|activity feed|share photos? to feed)\b/,
    journal: /\b(journal|diary|note[- ]?taking|daily notes|notes app)\b/,
    habit_streak: /\b(habit tracker|daily habit|routine tracker|streak counter)\b/,
    marketplace_match:
      /\b(marketplace|apply to|hire|gig|match owner|both sides|post request|job board)\b/,
    live_tracking: /\b(live (map|track)|gps track|en route|real[- ]?time location|track on map)\b/,
    booking:
      /\b(book(ing)?|schedule|appointment|reserve|calendar slot|availability)\b/,
    messaging: /\b(message|chat|inbox|dm|text (walker|owner|provider))\b/,
    collection:
      /\b(save|favorite|bookmark|wishlist|grocery list|shopping list|my lists)\b/,
    payments:
      /\b(pay|payment|subscribe|premium|stripe|checkout|payout|budget|\$\d)/,
  };
  const re = tests[capability];
  return re ? re.test(b) : false;
}

/** Capabilities we should not infer for this category unless the user clearly asked. */
const CATEGORY_BLOCKLIST: Partial<Record<AppCategory, CapabilityId[]>> = {
  pets: ["commerce", "social_feed", "journal", "habit_streak"],
  cooking: ["commerce", "social_feed", "marketplace_match", "live_tracking", "journal"],
  fitness: ["commerce", "journal", "marketplace_match", "social_feed"],
  productivity: ["commerce", "social_feed", "marketplace_match", "live_tracking"],
  education: ["commerce", "marketplace_match", "live_tracking", "habit_streak"],
  social: ["commerce", "booking", "marketplace_match"],
  shopping: [],
  general: [],
};

/** When primary shape is X, do not infer these unless explicit. */
const SHAPE_BLOCKLIST: Partial<Record<AppShape, CapabilityId[]>> = {
  local_marketplace: ["commerce", "social_feed", "journal", "habit_streak"],
  live_tracking: ["commerce", "social_feed", "journal", "habit_streak"],
  booking: ["commerce", "social_feed", "journal", "habit_streak"],
  delivery: ["social_feed", "journal", "habit_streak"],
  content_library: ["commerce", "marketplace_match", "live_tracking", "social_feed"],
  habit_streak: ["commerce", "marketplace_match", "social_feed", "journal"],
  job_gig: ["commerce", "social_feed", "journal", "habit_streak"],
  health_medical: ["commerce", "social_feed"],
  notes_docs: ["commerce", "marketplace_match", "social_feed", "live_tracking"],
  community_forum: ["commerce", "booking", "habit_streak"],
  music_audio: ["marketplace_match", "live_tracking", "booking"],
  photo_social: ["commerce", "booking", "marketplace_match"],
  wellness_mind: ["commerce", "marketplace_match", "live_tracking"],
  parenting: ["commerce", "marketplace_match", "social_feed"],
  language_learn: ["commerce", "marketplace_match", "live_tracking"],
  outdoor_trails: ["commerce", "social_feed", "marketplace_match"],
  alarm_safety: ["commerce", "social_feed", "journal"],
  travel: ["commerce", "social_feed"],
  events: ["commerce", "journal"],
  dating_match: ["commerce", "marketplace_match", "journal"],
  finance: ["commerce", "social_feed", "journal"],
  crypto_portfolio: ["commerce", "social_feed", "marketplace_match"],
  real_estate: ["social_feed", "habit_streak", "journal"],
  automotive: ["social_feed", "journal", "habit_streak"],
  inventory_smb: ["social_feed", "journal", "habit_streak"],
};

function commerceFitsApp(
  category: AppCategory,
  archetype: LayoutArchetype,
  primaryShape: AppShape | undefined,
  blob: string
): boolean {
  if (userExplicitlyWantsCapability("commerce", blob)) return true;
  if (category === "shopping") return true;
  if (archetype === "marketplace-shop") return true;
  if (primaryShape === "inventory_smb" || primaryShape === "real_estate") return true;
  return false;
}

function socialFeedFitsApp(
  archetype: LayoutArchetype,
  blob: string
): boolean {
  if (userExplicitlyWantsCapability("social_feed", blob)) return true;
  if (archetype === "social-feed") return true;
  if (archetype === "swipe-cards" && /\b(dating|match|swipe)\b/.test(blob)) return false;
  return false;
}

/** Drop capabilities that do not match this app's actual job. */
export function pruneRequiredCapabilities(
  required: Set<CapabilityId>,
  ctx: InterviewBuildContext,
  archetype: LayoutArchetype,
  blob: string
): void {
  const category = ctx.category;
  const primaryShape = ctx.appShapes[0] as AppShape | undefined;

  if (required.has("commerce") && !commerceFitsApp(category, archetype, primaryShape, blob)) {
    required.delete("commerce");
  }

  if (required.has("social_feed") && !socialFeedFitsApp(archetype, blob)) {
    required.delete("social_feed");
  }

  const blockFromCategory = CATEGORY_BLOCKLIST[category] ?? [];
  for (const cap of blockFromCategory) {
    if (required.has(cap) && !userExplicitlyWantsCapability(cap, blob)) {
      required.delete(cap);
    }
  }

  if (primaryShape) {
    const blockFromShape = SHAPE_BLOCKLIST[primaryShape] ?? [];
    for (const cap of blockFromShape) {
      if (required.has(cap) && !userExplicitlyWantsCapability(cap, blob)) {
        required.delete(cap);
      }
    }
  }

  // Archetype-only habits/journal — not for service/marketplace apps
  if (
    required.has("habit_streak") &&
    archetype !== "habit-streak" &&
    !userExplicitlyWantsCapability("habit_streak", blob)
  ) {
    required.delete("habit_streak");
  }
  if (
    required.has("journal") &&
    archetype !== "journal-notes" &&
    !userExplicitlyWantsCapability("journal", blob)
  ) {
    required.delete("journal");
  }
}

/** Loose keyword → capability; tightened so "post a walk" does not mean social feed. */
export function capabilitiesFromInterviewBlob(blob: string): CapabilityId[] {
  const out: CapabilityId[] = [];
  const b = blob.toLowerCase();
  const add = (id: CapabilityId) => {
    if (!out.includes(id)) out.push(id);
  };

  if (/sign[\s-]?up|sign[\s-]?in|login|register|account|auth/.test(b)) {
    add("auth_accounts");
  }
  if (userExplicitlyWantsCapability("payments", b)) {
    add("payments");
  }
  if (/message|chat|inbox|\bdm\b|coordinate/.test(b)) {
    add("messaging");
  }
  if (userExplicitlyWantsCapability("commerce", b)) {
    add("commerce");
  }
  if (userExplicitlyWantsCapability("booking", b)) {
    add("booking");
  }
  if (userExplicitlyWantsCapability("social_feed", b)) {
    add("social_feed");
  }
  if (userExplicitlyWantsCapability("collection", b)) {
    add("collection");
  }
  if (userExplicitlyWantsCapability("live_tracking", b)) {
    add("live_tracking");
  }
  if (userExplicitlyWantsCapability("habit_streak", b)) {
    add("habit_streak");
  }
  if (userExplicitlyWantsCapability("journal", b)) {
    add("journal");
  }
  if (/recipe|lesson|workout|browse library|content library|media library|read\b/.test(b)) {
    add("content_browse");
  }
  if (
    /marketplace|match.*owner|both sides|apply.*request|hire.*local|walker|dog walk|gig worker|post request/.test(
      b
    )
  ) {
    add("marketplace_match");
    add("status_workflow");
  }

  return out;
}

export function archetypeIsKnown(id?: string): id is LayoutArchetype {
  return Boolean(id?.trim() && id in LAYOUT_ARCHETYPES);
}
