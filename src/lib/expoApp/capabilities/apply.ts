import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import { wireMessagingInPreview } from "../applyMessagingPreview";
import { enrichExpoContent } from "../enrichContent";
import { enforceProductShape } from "../enforceProductShape";
import { imageForCategory } from "../images";
import { seedActionPlan } from "../actionPlanSeed";
import { buildAppBlueprint } from "../smartBlueprint";
import { withLegalSettings } from "../smartInteractions";
import { buildTheme } from "../theme";
import type { ExpoAppModel, ExpoAppModelInput, ExpoIconName, ExpoListItem } from "../types";
import { assignPreviewPatterns } from "../preview/assignPatterns";
import { scopeNeedsActionPlan } from "./scope";
import type { CapabilityAuditReport, CapabilityGap, CapabilityId } from "./types";

function modelToInput(model: ExpoAppModel): ExpoAppModelInput {
  const { theme: _t, version: _v, capabilities: _c, capabilityAudit: _a, ...input } = model;
  return input;
}

function inputToModel(input: ExpoAppModelInput, base: ExpoAppModel): ExpoAppModel {
  return {
    ...base,
    ...input,
    version: 1,
    theme: base.theme,
    capabilities: base.capabilities,
  };
}

function gapIds(report: CapabilityAuditReport, capability: CapabilityId | "global"): Set<string> {
  const gaps: CapabilityGap[] =
    capability === "global"
      ? report.globalGaps
      : (report.results.find((r) => r.capability === capability)?.gaps ?? []);
  return new Set(
    gaps.filter((g) => g.fixable && !g.suggestOnly).map((g) => g.id)
  );
}

function hasFix(report: CapabilityAuditReport, capability: CapabilityId | "global", id?: string): boolean {
  const ids = gapIds(report, capability);
  if (!id) return ids.size > 0;
  return ids.has(id);
}

function ensurePreviewActions(model: ExpoAppModel): ExpoAppModel {
  const seeded = seedActionPlan(model);
  const existing = model.previewActions;
  if (!existing?.rules?.length) {
    return { ...model, previewActions: seeded };
  }
  const byMatch = new Map(existing.rules.map((r) => [r.match.toLowerCase(), r]));
  for (const rule of seeded.rules) {
    if (!byMatch.has(rule.match.toLowerCase())) {
      byMatch.set(rule.match.toLowerCase(), rule);
    }
  }
  return {
    ...model,
    previewActions: {
      messagingTabId: existing.messagingTabId ?? seeded.messagingTabId,
      feedTabId: existing.feedTabId ?? seeded.feedTabId,
      rules: [...byMatch.values()],
    },
  };
}

function addStatusChips(model: ExpoAppModel): ExpoAppModel {
  const patchItems = (items: ExpoListItem[]) =>
    items.map((it) => {
      if (it.badge?.trim()) return it;
      const action = (it.primaryAction ?? "").toLowerCase();
      if (/apply|accept|book|confirm|open|active|pending|matched/.test(action)) {
        const badge = /apply/.test(action)
          ? "Open"
          : /accept|confirm/.test(action)
            ? "Matched"
            : /book/.test(action)
              ? "Scheduled"
              : "Active";
        return { ...it, badge, meta: it.meta ?? "Updated just now" };
      }
      if (/walk|request|job|gig|service/i.test(`${it.title} ${it.subtitle}`)) {
        return { ...it, badge: it.badge ?? "Open", meta: it.meta ?? "Nearby" };
      }
      return it;
    });

  return {
    ...model,
    home: {
      ...model.home,
      sections: model.home.sections.map((s) => ({
        ...s,
        items: patchItems(s.items),
      })),
    },
    tabScreens: Object.fromEntries(
      Object.entries(model.tabScreens).map(([id, screen]) => [
        id,
        { ...screen, items: patchItems(screen.items) },
      ])
    ),
  };
}

function ensureCommerceTabs(model: ExpoAppModel, mp: MasterBuildPrompt): ExpoAppModel {
  const category = model.category;
  const tabs = [...model.tabs];
  const tabScreens = { ...model.tabScreens };
  let shopId: string =
    tabs.find((t) => /shop|store|browse/i.test(`${t.id} ${t.label}`))?.id ?? "";
  let cartId: string =
    tabs.find((t) => /cart|bag/i.test(`${t.id} ${t.label}`))?.id ?? "";

  if (!shopId) {
    shopId = "shop";
    if (!tabs.some((t) => t.id === shopId)) {
      tabs.splice(Math.max(0, tabs.length - 1), 0, {
        id: shopId,
        label: "Shop",
        icon: "shopping-cart" as ExpoIconName,
      });
    }
    tabScreens[shopId] = tabScreens[shopId] ?? {
      title: "Shop",
      subtitle: `Browse products in ${mp.appName}`,
      items: [
        {
          id: "product-1",
          title: "Featured item",
          subtitle: "Top pick this week",
          meta: "$24",
          imageUrl: imageForCategory(category, 3),
          primaryAction: "Add to cart",
          detailType: "article",
          body: "Quality pick with fast delivery — tap Add to cart to try checkout in the preview.",
        },
        {
          id: "product-2",
          title: "Customer favorite",
          subtitle: "Highly rated",
          meta: "$18",
          imageUrl: imageForCategory(category, 4),
          primaryAction: "Add to cart",
          detailType: "article",
          body: "A reliable choice — prices and checkout are preview-only until you connect payments.",
        },
      ],
    };
  }

  if (!cartId) {
    cartId = "cart";
    if (!tabs.some((t) => t.id === cartId)) {
      tabs.splice(Math.max(0, tabs.length - 1), 0, {
        id: cartId,
        label: "Cart",
        icon: "list" as ExpoIconName,
      });
    }
    tabScreens[cartId] = tabScreens[cartId] ?? {
      title: "Cart",
      subtitle: "Review items before checkout",
      items: [],
    };
  }

  return { ...model, tabs, tabScreens };
}

function ensureJournalTab(model: ExpoAppModel, mp: MasterBuildPrompt): ExpoAppModel {
  if (model.tabs.some((t) => /note|journal/i.test(`${t.id} ${t.label}`))) return model;
  const tabId = "notes";
  return {
    ...model,
    tabs: [
      ...model.tabs.filter((t) => t.id !== "profile"),
      { id: tabId, label: "Notes", icon: "book-open" as ExpoIconName },
      ...model.tabs.filter((t) => t.id === "profile"),
    ],
    tabScreens: {
      ...model.tabScreens,
      [tabId]: {
        title: "Notes",
        subtitle: `Capture ideas in ${mp.appName}`,
        items: [
          {
            id: "note-1",
            title: "Quick thought",
            subtitle: "Tap to open the full note",
            meta: "Today",
            imageUrl: imageForCategory(model.category, 5),
            primaryAction: "Open",
            detailType: "article",
            body: "Your notes stay organized with tags and search in the full app.",
          },
        ],
      },
    },
  };
}

function ensureSocialFeedSection(model: ExpoAppModel): ExpoAppModel {
  const hasFeed = model.home.sections.some((s) =>
    /feed|post|activity|updates/i.test(s.title)
  );
  if (hasFeed) return model;
  const category = model.category;
  return {
    ...model,
    home: {
      ...model.home,
      sections: [
        {
          title: "Feed",
          items: [
            {
              id: "feed-1",
              title: "Latest update",
              subtitle: "See what people are sharing",
              meta: "2h ago",
              imageUrl: imageForCategory(category, 6),
              primaryAction: "Open",
              detailType: "article",
              body: "Posts from people you follow — react and comment in the full app.",
            },
            {
              id: "feed-2",
              title: "Trending now",
              subtitle: "Popular in your network",
              meta: "5h ago",
              imageUrl: imageForCategory(category, 7),
              primaryAction: "Open",
              detailType: "article",
              body: "Discover what is resonating with your community right now.",
            },
          ],
        },
        ...model.home.sections,
      ],
    },
  };
}

function ensureHabitStreakUi(model: ExpoAppModel): ExpoAppModel {
  if (/streak|habit|daily/i.test(JSON.stringify(model.home).toLowerCase())) return model;
  return {
    ...model,
    home: {
      ...model.home,
      sections: [
        {
          title: "Today",
          items: [
            {
              id: "habit-streak",
              title: "3-day streak",
              subtitle: "Keep it going — check in today",
              meta: "Daily",
              badge: "Streak",
              imageUrl: imageForCategory(model.category, 8),
              primaryAction: "Check in",
              detailType: "generic",
            },
          ],
        },
        ...model.home.sections,
      ],
    },
  };
}

function ensureMarketplaceHero(model: ExpoAppModel): ExpoAppModel {
  const hero = `${model.home.heroLabel} ${model.home.heroSublabel}`.toLowerCase();
  if (/post|request|list|hire|find|browse/.test(hero)) return model;
  return {
    ...model,
    home: {
      ...model.home,
      heroLabel: model.home.heroLabel || "Post a request",
      heroSublabel:
        model.home.heroSublabel || "Browse nearby listings and match in minutes",
    },
  };
}

function ensureCollectionTab(model: ExpoAppModel, mp: MasterBuildPrompt, interview: InterviewTurn[]): ExpoAppModel {
  const blueprint = buildAppBlueprint(mp, interview);
  const collectionTabId = blueprint.collectionTabId ?? "lists";
  if (model.tabs.some((t) => t.id === collectionTabId)) return model;
  if (model.tabScreens[collectionTabId]?.items?.length) return model;

  const tabs = [...model.tabs];
  if (!tabs.some((t) => t.id === collectionTabId)) {
    tabs.splice(Math.max(0, tabs.length - 1), 0, {
      id: collectionTabId,
      label: blueprint.collectionActionLabel.replace(/^Add to /i, "") || "Lists",
      icon: "list" as ExpoIconName,
    });
  }
  return {
    ...model,
    tabs,
    tabScreens: {
      ...model.tabScreens,
      [collectionTabId]: {
        title: blueprint.collectionActionLabel.replace(/^Add to /i, "") || "Your list",
        subtitle: "Items you save from details appear here",
        items: model.tabScreens[collectionTabId]?.items ?? [],
      },
    },
  };
}

function ensureBookingItems(model: ExpoAppModel, mp: MasterBuildPrompt): ExpoAppModel {
  const hasBook = Object.values(model.tabScreens).some((s) =>
    s.items.some((it) => /book|reserve|schedule/i.test(it.primaryAction ?? ""))
  );
  if (hasBook) return model;

  const browseTab =
    model.tabs.find((t) => /browse|book|schedule|walk/i.test(`${t.id} ${t.label}`))?.id ??
    model.tabs.find((t) => t.id !== "home" && t.id !== "profile")?.id;

  if (!browseTab || !model.tabScreens[browseTab]) return model;

  const screen = model.tabScreens[browseTab];
  if (screen.items.length >= 2) {
    const items = screen.items.map((it, i) =>
      i === 0 && !it.primaryAction
        ? { ...it, primaryAction: "Book", badge: it.badge ?? "Available" }
        : it
    );
    return {
      ...model,
      tabScreens: { ...model.tabScreens, [browseTab]: { ...screen, items } },
    };
  }

  return {
    ...model,
    tabScreens: {
      ...model.tabScreens,
      [browseTab]: {
        ...screen,
        items: [
          ...screen.items,
          {
            id: "slot-today",
            title: "Today · 4:00 PM",
            subtitle: "Open slot — tap to reserve",
            meta: "Available",
            badge: "Open",
            imageUrl: imageForCategory(model.category, 9),
            primaryAction: "Book",
            detailType: "article",
            body: `Reserve this slot in ${mp.appName} — confirmation appears in the preview.`,
          },
        ],
      },
    },
  };
}

function inScope(capability: CapabilityId | "global", scope: CapabilityId[] | undefined): boolean {
  if (!scope?.length) return true;
  if (capability === "global") return scopeNeedsActionPlan(scope);
  return scope.includes(capability);
}

/** Deterministic expanders — one pass per capability with fixable gaps. */
export function applyCapabilityFixes(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  interview: InterviewTurn[],
  report: CapabilityAuditReport,
  scope?: CapabilityId[]
): { model: ExpoAppModel; fixed: string[] } {
  let next = { ...model };
  const fixed: string[] = [];

  const mark = (label: string) => {
    if (!fixed.includes(label)) fixed.push(label);
  };

  if (
    inScope("global", scope) &&
    (hasFix(report, "global", "global-fonts") || hasFix(report, "global", "global-accent"))
  ) {
    next = { ...next, theme: buildTheme(mp) };
    mark("theme");
  }

  if (inScope("dual_roles", scope) && hasFix(report, "dual_roles")) {
    const enriched = enforceProductShape(modelToInput(next), mp, interview);
    next = inputToModel(enriched, next);
    mark("dual_roles");
  }

  if (inScope("content_browse", scope) && hasFix(report, "content_browse")) {
    const enriched = enrichExpoContent(modelToInput(next), mp, interview);
    next = inputToModel(enriched, next);
    mark("content_browse");
  }

  if (inScope("collection", scope) && hasFix(report, "collection")) {
    next = ensureCollectionTab(next, mp, interview);
    const enriched = enrichExpoContent(modelToInput(next), mp, interview);
    next = inputToModel(enriched, next);
    mark("collection");
  }

  if (inScope("marketplace_match", scope) && hasFix(report, "marketplace_match")) {
    const shaped = enforceProductShape(modelToInput(next), mp, interview);
    next = inputToModel(shaped, next);
    next = ensureMarketplaceHero(next);
    mark("marketplace_match");
  }

  if (inScope("live_tracking", scope) && hasFix(report, "live_tracking")) {
    const shaped = enforceProductShape(modelToInput(next), mp, interview);
    next = inputToModel(shaped, next);
    mark("live_tracking");
  }

  if (inScope("messaging", scope) && hasFix(report, "messaging")) {
    const wired = wireMessagingInPreview(next, mp);
    next = assignPreviewPatterns(wired.model, mp, interview);
    mark("messaging");
  }

  if (inScope("status_workflow", scope) && hasFix(report, "status_workflow")) {
    next = addStatusChips(next);
    next = ensurePreviewActions(next);
    mark("status_workflow");
  }

  if (inScope("booking", scope) && hasFix(report, "booking")) {
    next = ensureBookingItems(next, mp);
    next = ensurePreviewActions(next);
    mark("booking");
  }

  if (inScope("commerce", scope) && hasFix(report, "commerce")) {
    next = ensureCommerceTabs(next, mp);
    next = ensurePreviewActions(next);
    mark("commerce");
  }

  if (inScope("social_feed", scope) && hasFix(report, "social_feed")) {
    next = ensureSocialFeedSection(next);
    mark("social_feed");
  }

  if (inScope("habit_streak", scope) && hasFix(report, "habit_streak")) {
    next = ensureHabitStreakUi(next);
    mark("habit_streak");
  }

  if (inScope("journal", scope) && hasFix(report, "journal")) {
    next = ensureJournalTab(next, mp);
    mark("journal");
  }

  if (inScope("auth_accounts", scope) && hasFix(report, "auth_accounts", "auth-account-controls")) {
    next = withLegalSettings(next);
    mark("auth_accounts");
  }

  if (
    inScope("global", scope) &&
    hasFix(report, "global", "global-preview-patterns")
  ) {
    next = assignPreviewPatterns(next, mp, interview);
    mark("preview_patterns");
  }

  if (
    inScope("global", scope) &&
    (hasFix(report, "global", "global-action-plan") || hasFix(report, "global"))
  ) {
    next = ensurePreviewActions(next);
    mark("preview_actions");
  }

  if (
    inScope("messaging", scope) &&
    (hasFix(report, "messaging", "messaging-actions") ||
      hasFix(report, "messaging", "messaging-reply-rules"))
  ) {
    next = ensurePreviewActions(next);
    mark("messaging_actions");
  }

  return { model: next, fixed };
}
