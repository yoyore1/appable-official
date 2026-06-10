import type { MasterBuildPrompt } from "@/lib/types";
import type { ExpoAppModel } from "@/lib/expoApp/types";
import { inferProductSpec } from "@/lib/expoApp/productSpec";

export type InsightsAppProfile =
  | "marketplace"
  | "subscription"
  | "content"
  | "habit"
  | "commerce"
  | "general";

export interface CatalogEvent {
  id: string;
  label: string;
}

export interface CatalogFunnel {
  id: string;
  label: string;
  steps: string[];
}

const BASE_EVENTS: CatalogEvent[] = [
  { id: "signup_completed", label: "Sign up completed" },
  { id: "screen_view", label: "Screen view" },
];

const PROFILES: Record<
  InsightsAppProfile,
  { events: CatalogEvent[]; funnels: CatalogFunnel[] }
> = {
  marketplace: {
    events: [
      { id: "listing_created", label: "Listing / post created" },
      { id: "listing_viewed", label: "Listing viewed" },
      { id: "apply_tapped", label: "Apply / request tapped" },
      { id: "match_confirmed", label: "Match confirmed" },
      { id: "chat_opened", label: "Chat opened" },
      { id: "message_sent", label: "Message sent" },
    ],
    funnels: [
      {
        id: "marketplace_core",
        label: "Marketplace core",
        steps: ["signup_completed", "listing_created", "apply_tapped", "match_confirmed", "chat_opened"],
      },
    ],
  },
  subscription: {
    events: [
      { id: "paywall_viewed", label: "Paywall viewed" },
      { id: "trial_started", label: "Trial started" },
      { id: "purchase_completed", label: "Purchase completed" },
    ],
    funnels: [
      {
        id: "monetization",
        label: "Subscription",
        steps: ["signup_completed", "paywall_viewed", "trial_started", "purchase_completed"],
      },
    ],
  },
  commerce: {
    events: [
      { id: "product_viewed", label: "Product viewed" },
      { id: "cart_add", label: "Added to cart" },
      { id: "checkout_started", label: "Checkout started" },
      { id: "purchase_completed", label: "Purchase completed" },
    ],
    funnels: [
      {
        id: "checkout",
        label: "Checkout",
        steps: ["product_viewed", "cart_add", "checkout_started", "purchase_completed"],
      },
    ],
  },
  content: {
    events: [
      { id: "content_viewed", label: "Content viewed" },
      { id: "content_saved", label: "Content saved" },
      { id: "share_tapped", label: "Share tapped" },
    ],
    funnels: [
      {
        id: "engagement",
        label: "Content engagement",
        steps: ["signup_completed", "content_viewed", "content_saved"],
      },
    ],
  },
  habit: {
    events: [
      { id: "habit_logged", label: "Habit logged" },
      { id: "streak_milestone", label: "Streak milestone" },
    ],
    funnels: [
      {
        id: "retention",
        label: "Habit retention",
        steps: ["signup_completed", "habit_logged", "streak_milestone"],
      },
    ],
  },
  general: {
    events: [{ id: "primary_cta_tapped", label: "Primary action" }],
    funnels: [
      {
        id: "activation",
        label: "Activation",
        steps: ["signup_completed", "primary_cta_tapped"],
      },
    ],
  },
};

export function inferInsightsProfile(
  mp: MasterBuildPrompt,
  model?: ExpoAppModel | null
): InsightsAppProfile {
  const spec = inferProductSpec(mp);
  const blob = `${mp.description} ${mp.features.join(" ")} ${mp.audience}`.toLowerCase();
  if (spec.hasDualRoles || /marketplace|two.?sided|owner|walker|buyer|seller/.test(blob)) {
    return "marketplace";
  }
  if (/subscribe|subscription|premium|paywall/.test(blob)) return "subscription";
  if (/shop|cart|checkout|ecommerce|store/.test(blob)) return "commerce";
  if (/habit|streak|daily/.test(blob)) return "habit";
  if (/content|feed|library|course/.test(blob)) return "content";
  return "general";
}

export function eventCatalogForProject(
  mp: MasterBuildPrompt,
  model?: ExpoAppModel | null
): { profile: InsightsAppProfile; events: CatalogEvent[]; funnels: CatalogFunnel[] } {
  const profile = inferInsightsProfile(mp, model);
  const pack = PROFILES[profile];
  return {
    profile,
    events: [...BASE_EVENTS, ...pack.events],
    funnels: pack.funnels,
  };
}

export function provisionEventIds(mp: MasterBuildPrompt, model?: ExpoAppModel | null): string[] {
  return eventCatalogForProject(mp, model).events.map((e) => e.id);
}
