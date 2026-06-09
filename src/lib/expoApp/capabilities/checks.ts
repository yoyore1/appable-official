import { findTabId } from "../tabIds";
import { itemHasContentDetail } from "../genericDetails";
import { validateActionPlan, collectPrimaryActionLabels } from "../actionPlanSeed";
import {
  modelHasAccountControls,
  withLegalSettings,
} from "../smartInteractions";
import type { AppCategory } from "../inferCategory";
import type { ExpoAppModel, ExpoListItem } from "../types";
import type { CapabilityGap, CapabilityId } from "./types";

function modelBlob(model: ExpoAppModel): string {
  return JSON.stringify(model).toLowerCase();
}

function allListItems(model: ExpoAppModel): ExpoListItem[] {
  const items: ExpoListItem[] = [];
  for (const sec of model.home.sections) items.push(...sec.items);
  if (model.homeByRole) {
    for (const block of Object.values(model.homeByRole)) {
      for (const sec of block.sections) items.push(...sec.items);
    }
  }
  for (const screen of Object.values(model.tabScreens)) items.push(...screen.items);
  return items;
}

function hasTab(model: ExpoAppModel, re: RegExp): boolean {
  return model.tabs.some((t) => re.test(`${t.id} ${t.label}`));
}

function tabItemCount(model: ExpoAppModel, re: RegExp): number {
  const tab = model.tabs.find((t) => re.test(`${t.id} ${t.label}`));
  if (!tab) return 0;
  return model.tabScreens[tab.id]?.items?.length ?? 0;
}

function itemsMissingDetail(model: ExpoAppModel, category: AppCategory): number {
  let n = 0;
  for (const it of allListItems(model)) {
    if (!itemHasContentDetail(it, category)) n++;
  }
  return n;
}

function itemsWithStatusChip(model: ExpoAppModel): number {
  return allListItems(model).filter((it) => Boolean(it.badge?.trim())).length;
}

function previewTargetsMissingPatterns(model: ExpoAppModel): string[] {
  const missing: string[] = [];
  if (!model.previewPatterns?.home) missing.push("Home");
  if (!model.previewPatterns?.detail) missing.push("Detail");
  for (const tab of model.tabs) {
    if (tab.id === "home" || tab.id === "profile") continue;
    const pattern =
      model.previewPatterns?.tabs[tab.id] ?? model.tabScreens[tab.id]?.patternId;
    if (!pattern) missing.push(tab.label || tab.id);
  }
  return missing;
}

function primaryActionsWired(model: ExpoAppModel): string[] {
  const labels = collectPrimaryActionLabels(model);
  const plan = model.previewActions;
  if (!plan?.rules?.length) return labels;
  return labels.filter(
    (label) =>
      !plan.rules.some((r) => label.toLowerCase().includes(r.match.toLowerCase()))
  );
}

/** Global UI/UX checks — every app type. */
export function auditGlobal(model: ExpoAppModel): CapabilityGap[] {
  const gaps: CapabilityGap[] = [];
  const t = model.theme;

  if (!t?.fontDisplay || !t?.fontBody) {
    gaps.push({
      capability: "global",
      layer: "ui",
      id: "global-fonts",
      message: "Theme missing display/body font pairing",
      fixable: true,
    });
  }
  if (!t?.accent || t.accent.length < 4) {
    gaps.push({
      capability: "global",
      layer: "ui",
      id: "global-accent",
      message: "Theme missing accent color",
      fixable: true,
    });
  }
  if (model.tabs.length < 3) {
    gaps.push({
      capability: "global",
      layer: "ux",
      id: "global-tabs",
      message: "Need at least 3 tabs for clear navigation",
      fixable: false,
    });
  }
  if (model.onboarding.length < 2) {
    gaps.push({
      capability: "global",
      layer: "ux",
      id: "global-onboarding",
      message: "Onboarding needs at least 2 slides",
      fixable: false,
    });
  }

  const unwired = primaryActionsWired(model);
  if (unwired.length > 0) {
    gaps.push({
      capability: "global",
      layer: "behavior",
      id: "global-action-plan",
      message: `Buttons not wired in preview: ${unwired.slice(0, 4).join(", ")}`,
      fixable: true,
    });
  }

  const missingPatterns = previewTargetsMissingPatterns(model);
  if (missingPatterns.length > 0) {
    gaps.push({
      capability: "global",
      layer: "ui",
      id: "global-preview-patterns",
      message: `Preview UI patterns missing for: ${missingPatterns.slice(0, 5).join(", ")}`,
      fixable: true,
    });
  }

  const planIssues = validateActionPlan(model, model.previewActions);
  for (const msg of planIssues.slice(0, 3)) {
    gaps.push({
      capability: "global",
      layer: "behavior",
      id: `global-plan-${planIssues.indexOf(msg)}`,
      message: msg,
      fixable: true,
    });
  }

  return gaps;
}

type CheckFn = (model: ExpoAppModel) => CapabilityGap[];

const CHECKS: Record<CapabilityId, CheckFn> = {
  auth_accounts: (model) => {
    const gaps: CapabilityGap[] = [];
    const authOn = Boolean(model.flow?.auth?.enabled);
    if (!authOn) {
      gaps.push({
        capability: "auth_accounts",
        layer: "behavior",
        id: "auth-not-enabled",
        message: "Sign-up / sign-in flow not in preview",
        fixable: false,
        suggestOnly: true,
      });
      return gaps;
    }
    const acct = modelHasAccountControls(withLegalSettings(model));
    if (!acct.signOut || !acct.deleteAccount) {
      gaps.push({
        capability: "auth_accounts",
        layer: "ux",
        id: "auth-account-controls",
        message: "Profile needs Sign out and Delete account when auth is enabled",
        fixable: true,
      });
    }
    return gaps;
  },

  dual_roles: (model) => {
    const gaps: CapabilityGap[] = [];
    if (!model.flow?.roles || model.flow.roles.length < 2) {
      gaps.push({
        capability: "dual_roles",
        layer: "behavior",
        id: "dual-roles-missing",
        message: "Two-sided app needs role picker (owner/provider, etc.)",
        fixable: true,
      });
    }
    if (!model.homeByRole || Object.keys(model.homeByRole).length < 2) {
      gaps.push({
        capability: "dual_roles",
        layer: "ux",
        id: "dual-home-by-role",
        message: "Each role needs its own home headline and sections",
        fixable: true,
      });
    }
    return gaps;
  },

  content_browse: (model) => {
    const gaps: CapabilityGap[] = [];
    const missing = itemsMissingDetail(model, model.category as AppCategory);
    const total = allListItems(model).length;
    if (total >= 2 && missing > Math.max(1, Math.floor(total * 0.4))) {
      gaps.push({
        capability: "content_browse",
        layer: "behavior",
        id: "content-detail-bodies",
        message: `${missing} cards missing full detail (body + steps)`,
        fixable: true,
      });
    }
    if (model.home.sections.every((s) => s.items.length === 0)) {
      gaps.push({
        capability: "content_browse",
        layer: "ux",
        id: "content-home-empty",
        message: "Home needs at least one content section with items",
        fixable: false,
      });
    }
    return gaps;
  },

  collection: (model) => {
    const gaps: CapabilityGap[] = [];
    const hasListTab = hasTab(model, /list|grocery|cart|library|saved|collection|plan/i);
    const hasSaveUi =
      model.capabilities.uiFeatures?.some((f) => /save|favorite|collection/i.test(f)) ??
      /save|favorite|add to/i.test(modelBlob(model));
    if (!hasListTab && !hasSaveUi) {
      gaps.push({
        capability: "collection",
        layer: "behavior",
        id: "collection-tab",
        message: "Need a collection/list tab or save affordance on cards",
        fixable: true,
      });
    }
    return gaps;
  },

  messaging: (model) => {
    const gaps: CapabilityGap[] = [];
    const tab = hasTab(model, /message|chat|inbox/i);
    const wired = Boolean(model.previewActions?.messagingTabId);
    const count = tabItemCount(model, /message|chat|inbox/i);
    const msgTabId =
      model.previewActions?.messagingTabId ??
      model.tabs.find((t) => /message|chat|inbox/i.test(`${t.id} ${t.label}`))?.id;
    const inboxPattern =
      msgTabId &&
      (model.previewPatterns?.tabs[msgTabId] === "inbox-threads" ||
        model.tabScreens[msgTabId]?.patternId === "inbox-threads");
    const threadCount = model.previewState?.threads?.length ?? 0;

    if (!tab) {
      gaps.push({
        capability: "messaging",
        layer: "behavior",
        id: "messaging-tab",
        message: "Messages / inbox tab missing",
        fixable: true,
      });
    } else if (count < 2) {
      gaps.push({
        capability: "messaging",
        layer: "ux",
        id: "messaging-threads",
        message: "Messages tab needs sample conversations",
        fixable: true,
      });
    }
    if (tab && !wired) {
      gaps.push({
        capability: "messaging",
        layer: "behavior",
        id: "messaging-actions",
        message: "Reply/Message buttons not wired to messaging tab",
        fixable: true,
      });
    }
    if (tab && wired && !inboxPattern) {
      gaps.push({
        capability: "messaging",
        layer: "ux",
        id: "messaging-inbox-pattern",
        message: "Messages tab should use inbox thread UI pattern",
        fixable: true,
      });
    }
    if (inboxPattern && threadCount < 2) {
      gaps.push({
        capability: "messaging",
        layer: "ux",
        id: "messaging-thread-data",
        message: "Inbox needs sample conversation threads in preview state",
        fixable: true,
      });
    }
    const hasReplyRule = model.previewActions?.rules?.some((r) =>
      /reply|message|chat/i.test(r.match)
    );
    if (msgTabId && !hasReplyRule) {
      gaps.push({
        capability: "messaging",
        layer: "behavior",
        id: "messaging-reply-rules",
        message: "Missing compose/reply action rules",
        fixable: true,
      });
    }
    return gaps;
  },

  marketplace_match: (model) => {
    const gaps: CapabilityGap[] = [];
    const blob = modelBlob(model);
    const hasBrowse =
      hasTab(model, /browse|discover|walk|request|job|gig|search/i) ||
      /request|browse|apply|nearby|open/i.test(blob);
    const hasPostCta = /post|request|create|list|hire/i.test(
      `${model.home.heroLabel} ${model.home.heroSublabel}`.toLowerCase()
    );
    if (!hasBrowse) {
      gaps.push({
        capability: "marketplace_match",
        layer: "ux",
        id: "marketplace-browse",
        message: "Marketplace needs browse/discover tab or request list",
        fixable: true,
      });
    }
    if (!hasPostCta) {
      gaps.push({
        capability: "marketplace_match",
        layer: "ux",
        id: "marketplace-post-cta",
        message: "Home hero should invite posting a request or listing",
        fixable: true,
      });
    }
    return gaps;
  },

  status_workflow: (model) => {
    const gaps: CapabilityGap[] = [];
    const withActions = allListItems(model).filter((it) => it.primaryAction?.trim());
    const withStatus = itemsWithStatusChip(model);
    if (withActions.length >= 2 && withStatus < 1) {
      gaps.push({
        capability: "status_workflow",
        layer: "ux",
        id: "status-chips",
        message: "Apply/Book/Accept flows need visible status chips on cards",
        fixable: true,
      });
    }
    const statusActions = withActions.filter((it) =>
      /accept|apply|book|confirm|complete|start|post/i.test(it.primaryAction ?? "")
    );
    if (statusActions.length > 0) {
      const unwired = statusActions.filter((it) => {
        const label = it.primaryAction ?? "";
        return !model.previewActions?.rules?.some(
          (r) =>
            label.toLowerCase().includes(r.match.toLowerCase()) &&
            r.kind === "update_status"
        );
      });
      if (unwired.length > 0) {
        gaps.push({
          capability: "status_workflow",
          layer: "behavior",
          id: "status-action-rules",
          message: "Status buttons should update badge/meta in preview",
          fixable: true,
        });
      }
    }
    return gaps;
  },

  booking: (model) => {
    const gaps: CapabilityGap[] = [];
    const bookItems = allListItems(model).filter((it) =>
      /book|reserve|schedule|slot/i.test(
        `${it.primaryAction ?? ""} ${it.title} ${it.subtitle}`
      )
    );
    const hasBookTab = hasTab(model, /book|schedule|calendar|availability/i);
    if (!hasBookTab && bookItems.length < 1) {
      gaps.push({
        capability: "booking",
        layer: "behavior",
        id: "booking-flow",
        message: "Booking app needs schedulable items or availability tab",
        fixable: true,
      });
    }
    return gaps;
  },

  commerce: (model) => {
    const gaps: CapabilityGap[] = [];
    const hasShop = hasTab(model, /shop|store|products?/i);
    const hasCart = hasTab(model, /cart|bag|checkout/i);
    const hasPrice = /\$|€|£|price|usd/i.test(modelBlob(model));
    if (!hasShop) {
      gaps.push({
        capability: "commerce",
        layer: "behavior",
        id: "commerce-shop-tab",
        message: "Shop tab or product grid missing",
        fixable: true,
      });
    }
    if (!hasCart) {
      gaps.push({
        capability: "commerce",
        layer: "behavior",
        id: "commerce-cart-tab",
        message: "Cart tab missing for checkout flow",
        fixable: true,
      });
    }
    if (hasShop && !hasPrice) {
      gaps.push({
        capability: "commerce",
        layer: "ux",
        id: "commerce-prices",
        message: "Products should show prices in meta or subtitle",
        fixable: true,
      });
    }
    return gaps;
  },

  social_feed: (model) => {
    const gaps: CapabilityGap[] = [];
    const feedSection = model.home.sections.find((s) =>
      /feed|post|update|activity|recent/i.test(s.title)
    );
    const feedItems = feedSection?.items?.length ?? 0;
    const hasFeedTab = hasTab(model, /feed|home|discover/i);
    if (feedItems < 2 && !hasFeedTab) {
      gaps.push({
        capability: "social_feed",
        layer: "ux",
        id: "social-feed-content",
        message: "Social app needs a feed section or feed tab with posts",
        fixable: true,
      });
    }
    return gaps;
  },

  live_tracking: (model) => {
    const gaps: CapabilityGap[] = [];
    if (!/map|gps|live|track|en route|nearby pin/i.test(modelBlob(model))) {
      gaps.push({
        capability: "live_tracking",
        layer: "ux",
        id: "live-map",
        message: "Tracking app needs map card or live session on Home",
        fixable: true,
      });
    }
    return gaps;
  },

  payments: (model) => {
    const gaps: CapabilityGap[] = [];
    if (!/pay|subscribe|premium|pro\b|checkout|\$/.test(modelBlob(model))) {
      gaps.push({
        capability: "payments",
        layer: "behavior",
        id: "payments-ui",
        message: "Paywall or pricing screen not in preview",
        fixable: true,
        suggestOnly: true,
      });
    }
    return gaps;
  },

  habit_streak: (model) => {
    const gaps: CapabilityGap[] = [];
    if (!/streak|habit|daily|check.?in|day \d/i.test(modelBlob(model))) {
      gaps.push({
        capability: "habit_streak",
        layer: "ux",
        id: "habit-streak-ui",
        message: "Habit app needs streak or daily checklist visible",
        fixable: true,
      });
    }
    return gaps;
  },

  journal: (model) => {
    const gaps: CapabilityGap[] = [];
    if (!hasTab(model, /note|journal|memo/i)) {
      gaps.push({
        capability: "journal",
        layer: "behavior",
        id: "journal-tab",
        message: "Notes or journal tab missing",
        fixable: true,
      });
    }
    return gaps;
  },
};

export function runCapabilityChecks(
  model: ExpoAppModel,
  required: CapabilityId[]
): { results: import("./types").CapabilityCheckResult[]; globalGaps: CapabilityGap[] } {
  const globalGaps = auditGlobal(model);
  const results = required.map((capability) => {
    const gaps = CHECKS[capability](model);
    let status: import("./types").CapabilityStatus = "have";
    if (gaps.length > 0) {
      const hard = gaps.filter((g) => !g.suggestOnly);
      status = hard.some((g) => g.layer === "behavior") ? "missing" : "partial";
      if (hard.length === 0 && gaps.length > 0) status = "partial";
    }
    return { capability, status, gaps };
  });
  return { results, globalGaps };
}
