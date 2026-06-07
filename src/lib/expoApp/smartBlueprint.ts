import { inferOnboardingArchetype, type OnboardingArchetype } from "@/lib/expo/onboardingPack";
import { inferAppCapabilities } from "@/lib/expo/inferCapabilities";
import { buildFeaturePlan } from "./featurePlan";
import { buildPreviewUiConfig } from "./previewFeatures";
import type { AppCategory } from "./inferCategory";
import type { ExpoIconName } from "./types";
import type { MasterBuildPrompt } from "@/lib/types";

export interface BlueprintTab {
  id: string;
  label: string;
  icon: ExpoIconName;
  purpose: string;
}

export interface AppBlueprint {
  category: AppCategory;
  appName: string;
  audience: string;
  features: string[];
  tabs: BlueprintTab[];
  collectionTabId: string | null;
  collectionActionLabel: string;
  hero: { label: string; sublabel: string };
  onboardingAngles: [string, string, string];
  implicitUi: string[];
  liveApis: string[];
  audienceVoice: string;
  featureWiring: { feature: string; where: string }[];
  linkingRules: string[];
  wowBar: string[];
  onboardingArchetype: OnboardingArchetype;
}

function tabsForCategory(
  category: AppCategory,
  mp: MasterBuildPrompt,
  blob: string
): BlueprintTab[] {
  const f = mp.features;
  const pick = (id: string, label: string, icon: ExpoIconName, purpose: string) => ({
    id,
    label,
    icon,
    purpose,
  });

  if (category === "cooking" || /recipe|food|cook/.test(blob)) {
    return [
      pick("home", "Home", "home", "Hero scan + tonight's picks"),
      pick("recipes", "Recipes", "chef-hat", `Full recipes — ${f[0] ?? "browse"}`),
      pick("lists", "Lists", "shopping-cart", f[1] ?? "Grocery lists linked to recipes"),
      pick("profile", "Profile", "user", "Saved count + settings"),
    ];
  }
  if (category === "pets") {
    return [
      pick("home", "Home", "home", "Nearby walk requests + quick post"),
      pick("walks", "Walks", "search", f[0] ?? "Browse & apply to walks"),
      pick("messages", "Chat", "bell", f[1] ?? "Owner ↔ walker messaging"),
      pick("profile", "You", "user", "Dogs, payments, settings"),
    ];
  }
  if (category === "fitness") {
    return [
      pick("home", "Home", "home", "Today's workout + quick start"),
      pick("workouts", "Workouts", "utensils", f[0] ?? "Workout library with steps"),
      pick("plan", "Plan", "list", f[1] ?? "Weekly plan / checklist"),
      pick("profile", "Profile", "user", "Stats + goals"),
    ];
  }
  if (category === "productivity") {
    return [
      pick("home", "Home", "home", "Focus + quick capture"),
      pick("tasks", "Tasks", "list", f[0] ?? "Task list with checkoffs"),
      pick("library", "Library", "book-open", f[1] ?? "Saved items"),
      pick("profile", "Profile", "user", "Settings"),
    ];
  }
  if (category === "shopping") {
    return [
      pick("home", "Home", "home", "Deals + search"),
      pick("shop", "Shop", "search", f[0] ?? "Browse products"),
      pick("cart", "Cart", "shopping-cart", f[1] ?? "Cart / wishlist"),
      pick("profile", "Profile", "user", "Orders + settings"),
    ];
  }
  if (category === "education") {
    return [
      pick("home", "Home", "home", "Continue learning"),
      pick("discover", "Discover", "search", f[0] ?? "Courses & lessons"),
      pick("library", "Library", "book-open", f[1] ?? "Saved lessons"),
      pick("profile", "Profile", "user", "Progress"),
    ];
  }
  if (category === "social") {
    return [
      pick("home", "Home", "home", "Feed"),
      pick("discover", "Discover", "search", f[0] ?? "Explore"),
      pick("inbox", "Inbox", "bell", f[1] ?? "Messages"),
      pick("profile", "Profile", "user", "You"),
    ];
  }

  const t0 = (f[0]?.split(/\s+/)[0] ?? "Explore").slice(0, 12);
  const t1 = (f[1]?.split(/\s+/)[0] ?? "Library").slice(0, 12);
  return [
    pick("home", "Home", "home", mp.features[0] ?? "Main action"),
    pick("discover", t0, "search", mp.features[0] ?? "Discover"),
    pick("library", t1, "book-open", mp.features[1] ?? "Collection"),
    pick("profile", "Profile", "user", "Settings"),
  ];
}

/** Zero-token blueprint — tells the LLM exactly how to wow for THIS app. */
export function buildAppBlueprint(mp: MasterBuildPrompt): AppBlueprint {
  const plan = buildFeaturePlan(mp);
  const ui = buildPreviewUiConfig(mp);
  const cap = inferAppCapabilities(mp);
  const category = plan.category;
  const blob = [mp.description, mp.audience, mp.twist ?? "", ...mp.features].join(" ");

  const tabs = tabsForCategory(category, mp, blob);
  const collectionTabId =
    ui.collectionTabId ??
    tabs.find((t) => /list|cart|plan|library|shop|task/i.test(`${t.id} ${t.label}`))?.id ??
    null;

  const featureWiring = mp.features.map((feature, i) => ({
    feature,
    where:
      i === 0
        ? `Home hero + tab "${tabs[1]?.label}"`
        : i === 1
          ? `Tab "${tabs[2]?.label}" + onboarding slide ${i + 1}`
          : "Profile or home section",
  }));

  const wowBar = [
    `Speak to ${mp.audience} in ${mp.vibe.toLowerCase()} tone — never generic.`,
    "Every card opens REAL detail (body + steps or ingredients + steps).",
    "List/collection tab items reference content from other tabs by name.",
    "Profile stats feel lived-in (not round zeros). Save + collection work in preview.",
    `Implement: ${mp.features.join(" · ")}`,
  ];

  if (cap.capabilities.includes("vision_ai")) {
    wowBar.push("Home hero = photo/scan → real AI result flow.");
  }

  return {
    category,
    appName: mp.appName,
    audience: mp.audience,
    features: [...mp.features],
    tabs,
    collectionTabId,
    collectionActionLabel: ui.collectionActionLabel,
    hero: { label: cap.heroAction, sublabel: cap.heroSublabel },
    onboardingAngles: [
      `Slide 1: aha moment — ${mp.features[0] ?? "core value"}`,
      `Slide 2: built for ${mp.audience.split(/[,;]/)[0]?.trim() ?? mp.audience}`,
      `Slide 3: ${mp.features[1] ?? mp.features[0] ?? "get started"} — one tap away`,
    ],
    implicitUi: ui.features,
    liveApis: cap.capabilities,
    audienceVoice: `${mp.vibe} · for ${mp.audience}. Use their words from features.`,
    featureWiring,
    linkingRules: [
      collectionTabId
        ? `Grocery/list tab "${collectionTabId}" items must name recipes/content from home/recipes tab.`
        : "Link collection items to home content titles where possible.",
      "Home section 2 references something from tab 1 (e.g. 'From your last scan').",
    ],
    wowBar,
    onboardingArchetype: inferOnboardingArchetype(mp),
  };
}
