import { inferCategory, type AppCategory } from "./inferCategory";
import { buildPreviewUiConfigFromModel } from "./previewFeatures";
import type { ExpoAppModel, ExpoIconName, ExpoListItem } from "./types";

export type SettingsKind = "toggle" | "legal" | "info";
export type HeroMode = "vision_scan" | "open_content" | "goto_tab" | "quick_capture";
export type CollectionExtract = "ingredients" | "steps" | "body" | "title";

export interface SettingBinding {
  kind: SettingsKind;
  description: string;
  legalDoc?: "privacy" | "terms" | "support";
  toggleDefault: boolean;
}

export interface PreviewInteractionConfig {
  category: AppCategory;
  appName: string;
  heroMode: HeroMode;
  heroFallbackTabId: string | null;
  collectionTabId: string | null;
  collectionActionLabel: string;
  collectionExtract: CollectionExtract;
  listsTabIds: string[];
  savedStatPatterns: string[];
  settings: Record<string, SettingBinding>;
  share: {
    itemTitle: (item: ExpoListItem) => string;
    listTitle: string;
  };
  toasts: {
    saved: (title: string) => string;
    unsaved: string;
    addedToCollection: (count: number, label: string) => string;
    heroOpen: (title: string) => string;
    heroTab: (tabLabel: string) => string;
  };
}

function blobFromModel(model: ExpoAppModel): string {
  return [
    model.category,
    model.home.headline,
    model.home.subheadline,
    model.home.heroLabel,
    ...model.tabs.map((t) => `${t.id} ${t.label}`),
    ...Object.values(model.tabScreens).flatMap((s) => [s.title, s.subtitle]),
    ...model.profile.settings.map((s) => s.label),
  ]
    .join(" ")
    .toLowerCase();
}

function settingsKind(label: string): SettingsKind {
  const l = label.toLowerCase();
  if (/privacy|terms|legal|help|support|faq/.test(l)) return "legal";
  if (
    /notification|reminder|preference|theme|dietary|spice|portion|goal|level|connected|unit|display|alert/.test(
      l
    )
  ) {
    return "toggle";
  }
  return "info";
}

function legalDocForSetting(label: string): "privacy" | "terms" | "support" | undefined {
  const l = label.toLowerCase();
  if (/privacy|legal|shield|data/.test(l)) return "privacy";
  if (/terms|service/.test(l)) return "terms";
  if (/help|support|faq/.test(l)) return "support";
  return undefined;
}

export function primaryContentTab(model: ExpoAppModel): string | null {
  const hit = model.tabs.find(
    (t) => t.id !== "home" && t.id !== "profile" && model.tabScreens[t.id]
  );
  return hit?.id ?? Object.keys(model.tabScreens)[0] ?? null;
}

export function resolveTabScreen(
  model: ExpoAppModel,
  tabId: string
): { screen: ExpoAppModel["tabScreens"][string] | undefined; resolvedId: string } {
  if (tabId === "home" || tabId === "profile") {
    return { screen: undefined, resolvedId: tabId };
  }
  if (model.tabScreens[tabId]) {
    return { screen: model.tabScreens[tabId], resolvedId: tabId };
  }
  const fuzzy = Object.entries(model.tabScreens).find(
    ([id, screen]) =>
      id === tabId ||
      id.includes(tabId) ||
      tabId.includes(id) ||
      screen.title.toLowerCase().includes(tabId)
  );
  if (fuzzy) return { screen: fuzzy[1], resolvedId: fuzzy[0] };
  const first = Object.entries(model.tabScreens)[0];
  return first
    ? { screen: first[1], resolvedId: first[0] }
    : { screen: undefined, resolvedId: tabId };
}

function collectionTabId(model: ExpoAppModel): string | null {
  const ui = buildPreviewUiConfigFromModel(model);
  if (ui.collectionTabId) return ui.collectionTabId;
  const hit = model.tabs.find((t) =>
    /list|grocery|cart|plan|library|task|shop|wish|check/i.test(`${t.id} ${t.label}`)
  );
  return hit?.id ?? null;
}

function listsTabIds(model: ExpoAppModel, collectionId: string | null): string[] {
  return model.tabs
    .filter(
      (t) =>
        t.id === collectionId ||
        /list|grocery|cart|plan|library|task|shop|wish|check/i.test(`${t.id} ${t.label}`)
    )
    .map((t) => t.id);
}

function heroModeFor(model: ExpoAppModel, category: AppCategory): HeroMode {
  if (model.capabilities?.enabled?.includes("vision_ai")) return "vision_scan";
  if (category === "productivity" || /task|todo|capture|note/.test(blobFromModel(model))) {
    return "quick_capture";
  }
  if (category === "shopping" || /shop|cart|browse|deal/.test(blobFromModel(model))) {
    return "goto_tab";
  }
  return "open_content";
}

function heroFallbackTab(model: ExpoAppModel, category: AppCategory): string | null {
  if (category === "shopping") {
    return (
      model.tabs.find((t) => /shop|store|browse|discover/i.test(`${t.id} ${t.label}`))?.id ??
      primaryContentTab(model)
    );
  }
  if (category === "productivity") {
    return (
      model.tabs.find((t) => /task|list|inbox/i.test(`${t.id} ${t.label}`))?.id ??
      primaryContentTab(model)
    );
  }
  if (category === "fitness") {
    return (
      model.tabs.find((t) => /workout|train|plan/i.test(`${t.id} ${t.label}`))?.id ??
      primaryContentTab(model)
    );
  }
  if (category === "education") {
    return (
      model.tabs.find((t) => /discover|learn|course|library/i.test(`${t.id} ${t.label}`))?.id ??
      primaryContentTab(model)
    );
  }
  return primaryContentTab(model);
}

function collectionExtractFor(category: AppCategory, item?: ExpoListItem): CollectionExtract {
  if (category === "cooking" || item?.ingredients?.length) return "ingredients";
  if (category === "fitness" || category === "education") return "steps";
  if (category === "productivity") return "title";
  if (item?.steps?.length) return "steps";
  if (item?.body) return "body";
  return "title";
}

function describeSetting(
  label: string,
  model: ExpoAppModel,
  category: AppCategory
): string {
  const l = label.toLowerCase();
  const app = model.profile.displayName || model.home.headline;
  const audience = model.home.subheadline.split(/[.—]/)[0]?.trim() ?? model.home.subheadline;
  const mainTab =
    model.tabs.find((t) => t.id !== "home" && t.id !== "profile")?.label ?? "your content";
  const collectionTab = model.tabs.find((t) =>
    /list|cart|plan|library|task/i.test(`${t.id} ${t.label}`)
  )?.label;

  const byCategory: Partial<Record<AppCategory, Record<string, string>>> = {
    cooking: {
      dietary: `Default diet, allergies, and portions for ${audience}. New recipes respect these.`,
      spice: "Default spice and serving size — scales every recipe you open.",
      notification: `Meal reminders and ${collectionTab ?? "grocery"} nudges.`,
    },
    fitness: {
      goal: `Training level and weekly targets for ${audience}.`,
      level: "Adjust workout intensity — plans update automatically.",
      notification: `Workout reminders and ${collectionTab ?? "plan"} check-ins.`,
    },
    productivity: {
      theme: `Look and feel for ${app} — accent, density, dark mode.`,
      preference: `Defaults for ${mainTab} and quick capture.`,
      notification: `Due-date alerts and ${mainTab} reminders.`,
    },
    shopping: {
      notification: `Deal alerts and ${collectionTab ?? "cart"} updates.`,
      preference: `Shipping, sizes, and saved ${mainTab} filters.`,
    },
    education: {
      notification: `Lesson reminders and ${collectionTab ?? "library"} sync.`,
      preference: `Pace, subtitles, and ${mainTab} defaults.`,
    },
    social: {
      notification: "New posts, mentions, and message alerts.",
      privacy: `Who can see your posts and ${mainTab} activity.`,
    },
  };

  for (const [key, text] of Object.entries(byCategory[category] ?? {})) {
    if (l.includes(key)) return text;
  }

  if (/notification|reminder/.test(l)) {
    return `Alerts for ${mainTab}${collectionTab ? ` and ${collectionTab}` : ""}. Toggle anytime.`;
  }
  if (/privacy|legal|shield|data/.test(l)) {
    return `How ${app} handles photos, content, and account data.`;
  }
  if (/help|support|faq/.test(l)) {
    return `Help, FAQ, and contact for ${app}.`;
  }
  if (/account|profile|user/.test(l)) {
    return `Your ${app} profile on this device. Cloud sync in the published app.`;
  }
  if (/connected|integration|calendar|health/.test(l)) {
    return `Connect ${mainTab} to other apps you already use.`;
  }
  if (/theme|appearance|display/.test(l)) {
    return `Colors and layout for ${app}.`;
  }

  const tabHint = model.tabScreens[primaryContentTab(model) ?? ""]?.title;
  return tabHint
    ? `${label} — controls how ${tabHint.toLowerCase()} works in ${app}.`
    : `${label} for ${app}. Saved in this preview session.`;
}

function savedStatPatterns(category: AppCategory): string[] {
  const common = ["saved", "favorite", "bookmark", "library", "collected"];
  const extra: Record<AppCategory, string[]> = {
    cooking: ["recipe"],
    pets: ["walk", "walker", "dog"],
    fitness: ["workout", "session"],
    productivity: ["task", "done"],
    shopping: ["wish", "cart"],
    education: ["lesson", "course"],
    social: ["post"],
    general: [],
  };
  return [...common, ...extra[category]];
}

/** Dynamic interaction blueprint — same idea as smartBlueprint, for preview wiring. */
export function buildPreviewInteractionConfig(
  model: ExpoAppModel
): PreviewInteractionConfig {
  const category = (model.category as AppCategory) || inferCategory({
    appName: model.home.headline,
    description: model.home.subheadline,
    audience: model.home.subheadline,
    twist: null,
    features: Object.values(model.tabScreens).map((s) => s.title),
    layoutArchetype: "",
    vibe: model.theme.vibe,
    colors: "",
    screens: [],
    referenceApp: null,
  });
  const ui = buildPreviewUiConfigFromModel(model);
  const collId = collectionTabId(model);
  const appName = model.profile.displayName || model.home.headline;

  const settings: Record<string, SettingBinding> = {};
  for (const row of model.profile.settings) {
    settings[row.label] = {
      kind: settingsKind(row.label),
      description: describeSetting(row.label, model, category),
      legalDoc: legalDocForSetting(row.label),
      toggleDefault: true,
    };
  }

  return {
    category,
    appName,
    heroMode: heroModeFor(model, category),
    heroFallbackTabId: heroFallbackTab(model, category),
    collectionTabId: collId,
    collectionActionLabel: ui.collectionActionLabel,
    collectionExtract: collectionExtractFor(category),
    listsTabIds: listsTabIds(model, collId),
    savedStatPatterns: savedStatPatterns(category),
    settings,
    share: {
      itemTitle: (item) => `${item.title} — ${appName}`,
      listTitle: `${model.tabScreens[collId ?? ""]?.title ?? "My list"} — ${appName}`,
    },
    toasts: {
      saved: (title) => `Saved ${title}`,
      unsaved: "Removed from saved",
      addedToCollection: (count, label) =>
        `Added ${count} item${count === 1 ? "" : "s"} to ${label.replace(/^Add to /i, "")}`,
      heroOpen: (title) => model.home.heroLabel || `Opening ${title}`,
      heroTab: (tabLabel) => `Opening ${tabLabel}`,
    },
  };
}

export function extractCollectionLines(
  item: ExpoListItem,
  mode: CollectionExtract
): string[] {
  if (mode === "ingredients" && item.ingredients?.length) return item.ingredients;
  if (item.ingredients?.length) return item.ingredients;
  if ((mode === "steps" || mode === "body") && item.steps?.length) {
    return item.steps.map((s, i) => `Step ${i + 1}: ${s}`);
  }
  if (mode === "body" && item.body) return [item.body, ...(item.steps ?? [])];
  return [`${item.title} — ${item.subtitle}`];
}

export function isListsTab(tabId: string, ix: PreviewInteractionConfig): boolean {
  return ix.listsTabIds.includes(tabId);
}

const DEFAULT_SETTINGS: Record<AppCategory, { label: string; icon: ExpoIconName }[]> = {
  cooking: [
    { label: "Dietary preferences", icon: "utensils" },
    { label: "Spice & portions", icon: "settings" },
    { label: "Notifications", icon: "bell" },
    { label: "Privacy", icon: "shield" },
    { label: "Help & support", icon: "help-circle" },
  ],
  pets: [
    { label: "My dogs", icon: "user" },
    { label: "Payment", icon: "settings" },
    { label: "Notifications", icon: "bell" },
    { label: "Safety", icon: "shield" },
    { label: "Help & support", icon: "help-circle" },
  ],
  fitness: [
    { label: "Goals & level", icon: "settings" },
    { label: "Reminders", icon: "bell" },
    { label: "Connected apps", icon: "heart" },
    { label: "Privacy", icon: "shield" },
    { label: "Help & support", icon: "help-circle" },
  ],
  productivity: [
    { label: "Account", icon: "user" },
    { label: "Notifications", icon: "bell" },
    { label: "Themes", icon: "settings" },
    { label: "Privacy", icon: "shield" },
    { label: "Help & support", icon: "help-circle" },
  ],
  shopping: [
    { label: "Shipping & sizes", icon: "settings" },
    { label: "Deal alerts", icon: "bell" },
    { label: "Payment methods", icon: "shopping-cart" },
    { label: "Privacy", icon: "shield" },
    { label: "Help & support", icon: "help-circle" },
  ],
  education: [
    { label: "Learning pace", icon: "settings" },
    { label: "Reminders", icon: "bell" },
    { label: "Downloads", icon: "book-open" },
    { label: "Privacy", icon: "shield" },
    { label: "Help & support", icon: "help-circle" },
  ],
  social: [
    { label: "Account", icon: "user" },
    { label: "Notifications", icon: "bell" },
    { label: "Privacy", icon: "shield" },
    { label: "Blocked users", icon: "settings" },
    { label: "Help & support", icon: "help-circle" },
  ],
  general: [
    { label: "Account", icon: "user" },
    { label: "Notifications", icon: "bell" },
    { label: "Preferences", icon: "settings" },
    { label: "Privacy", icon: "shield" },
    { label: "Help & support", icon: "help-circle" },
  ],
};

/** Category-aware settings rows when LLM output is thin or generic. */
export function defaultSettingsRows(
  category: AppCategory
): { label: string; icon: ExpoIconName }[] {
  return DEFAULT_SETTINGS[category] ?? DEFAULT_SETTINGS.general;
}

const DEFAULT_STATS: Record<AppCategory, { label: string; value: string }[]> = {
  cooking: [
    { label: "Recipes saved", value: "12" },
    { label: "Lists shared", value: "4" },
    { label: "Scans", value: "8" },
  ],
  pets: [
    { label: "Walks booked", value: "8" },
    { label: "Saved walkers", value: "3" },
    { label: "Rating", value: "4.9" },
  ],
  fitness: [
    { label: "Workouts", value: "18" },
    { label: "Saved", value: "9" },
    { label: "Streak", value: "5d" },
  ],
  productivity: [
    { label: "Tasks done", value: "47" },
    { label: "Saved", value: "14" },
    { label: "Streak", value: "7d" },
  ],
  shopping: [
    { label: "Saved", value: "11" },
    { label: "Orders", value: "3" },
    { label: "In cart", value: "2" },
  ],
  education: [
    { label: "Lessons done", value: "6" },
    { label: "Saved", value: "10" },
    { label: "Streak", value: "4d" },
  ],
  social: [
    { label: "Posts", value: "24" },
    { label: "Saved", value: "8" },
    { label: "Following", value: "42" },
  ],
  general: [
    { label: "Saved", value: "12" },
    { label: "This week", value: "5" },
    { label: "Streak", value: "3d" },
  ],
};

export function defaultProfileStats(
  category: AppCategory
): { label: string; value: string }[] {
  return DEFAULT_STATS[category] ?? DEFAULT_STATS.general;
}

export function statUsesSavedCount(label: string, ix: PreviewInteractionConfig): boolean {
  const l = label.toLowerCase();
  return ix.savedStatPatterns.some((p) => l.includes(p));
}
