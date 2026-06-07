import { isDeferToRecommendation, profileFromMasterPrompt } from "@/lib/designResearch";
import { mergeFeatureList, parseUserFeatures } from "@/lib/expoApp/featurePlan";
import type { MasterBuildPrompt } from "@/lib/types";

/** Proven screen structures the build assembles from (internal — never shown in UX). */
export const LAYOUT_ARCHETYPES = {
  "tracker-dashboard": {
    label: "Tracker dashboard",
    description: "Stats header, progress rings, activity feed, quick-log CTA",
    defaultFeatures: ["Track daily progress", "View stats & trends", "Set goals & reminders"],
    defaultScreens: ["Onboarding", "Dashboard", "Log entry", "History", "Profile"],
    tamaguiComponents: ["YStack", "Progress", "Card", "Button", "Sheet"],
    matchApps: [
      "strava",
      "myfitnesspal",
      "fitbit",
      "apple health",
      "ynab",
      "mint",
      "copilot money",
      "clue",
      "flo",
    ],
    matchKeywords: /track|stat|dashboard|metric|log|progress|habit|streak|budget|expense|health data/i,
  },
  "swipe-cards": {
    label: "Swipe cards",
    description: "Card stack discovery, match/detail, filters, profile",
    defaultFeatures: ["Discover with swipe cards", "View rich profiles", "Match & connect"],
    defaultScreens: ["Onboarding", "Discover", "Matches", "Chat preview", "Profile"],
    tamaguiComponents: ["Card", "XStack", "Avatar", "Button", "AnimatePresence"],
    matchApps: ["tinder", "bumble", "hinge", "yelp", "zillow", "airbnb explore"],
    matchKeywords: /swipe|match|discover|date|dating|browse cards/i,
  },
  "social-feed": {
    label: "Social feed",
    description: "Stories rail, infinite feed, compose, notifications, profile grid",
    defaultFeatures: ["Scroll a personalized feed", "Post photos & updates", "Follow & react"],
    defaultScreens: ["Onboarding", "Home feed", "Create post", "Notifications", "Profile"],
    tamaguiComponents: ["ScrollView", "Card", "Avatar", "Input", "Tabs"],
    matchApps: [
      "instagram",
      "tiktok",
      "twitter",
      "x",
      "threads",
      "facebook",
      "linkedin",
      "reddit",
      "pinterest",
    ],
    matchKeywords: /feed|post|follow|social|share photo|timeline|reel|story/i,
  },
  "chat-messaging": {
    label: "Chat / messaging",
    description: "Inbox list, threaded chat, attachments, presence",
    defaultFeatures: ["Message friends in real time", "Group chats", "Share photos & links"],
    defaultScreens: ["Onboarding", "Chats", "Conversation", "New message", "Profile"],
    tamaguiComponents: ["Input", "ScrollView", "Avatar", "Bubble", "Sheet"],
    matchApps: [
      "whatsapp",
      "messenger",
      "telegram",
      "signal",
      "imessage",
      "slack",
      "discord",
      "snapchat",
    ],
    matchKeywords: /chat|message|text|dm|inbox|conversation|messaging/i,
  },
  "marketplace-shop": {
    label: "Marketplace / shop",
    description: "Search, product grid, detail, cart, checkout",
    defaultFeatures: ["Browse products", "Save to cart", "Secure checkout"],
    defaultScreens: ["Onboarding", "Shop home", "Product detail", "Cart", "Profile"],
    tamaguiComponents: ["Card", "Image", "Button", "Sheet", "Input"],
    matchApps: ["amazon", "etsy", "ebay", "shopify", "depop", "poshmark", "mercari"],
    matchKeywords: /shop|store|buy|cart|product|market|sell|checkout/i,
  },
  "booking-scheduling": {
    label: "Booking / scheduling",
    description: "Calendar, availability slots, booking flow, confirmations",
    defaultFeatures: ["Pick dates & times", "Book appointments", "Manage reservations"],
    defaultScreens: ["Onboarding", "Browse", "Availability", "Booking confirm", "Profile"],
    tamaguiComponents: ["Calendar", "Card", "Button", "Sheet", "Select"],
    matchApps: ["calendly", "airbnb", "opentable", "doordash", "uber", "lyft", "classpass"],
    matchKeywords: /book|schedule|appointment|reserve|calendar|slot|delivery|ride/i,
  },
  "content-library": {
    label: "Content library",
    description: "Categories, media cards, player/reader, progress, library",
    defaultFeatures: ["Browse lessons or media", "Resume where you left off", "Save favorites"],
    defaultScreens: ["Onboarding", "Library", "Player", "Categories", "Profile"],
    tamaguiComponents: ["Card", "ScrollView", "Progress", "Tabs", "Sheet"],
    matchApps: [
      "netflix",
      "spotify",
      "youtube",
      "duolingo",
      "masterclass",
      "coursera",
      "audible",
      "kindle",
    ],
    matchKeywords: /course|lesson|video|watch|listen|learn|media|library|stream/i,
  },
  "habit-streak": {
    label: "Habit / streak",
    description: "Streak counter, daily checklist, rewards, gentle reminders",
    defaultFeatures: ["Build daily habits", "Keep streaks alive", "Celebrate milestones"],
    defaultScreens: ["Onboarding", "Today", "Habits", "Rewards", "Profile"],
    tamaguiComponents: ["Progress", "Card", "Button", "Checkbox", "Sheet"],
    matchApps: ["duolingo", "streaks", "habitica", "fabulous", "headspace", "calm"],
    matchKeywords: /habit|streak|daily|routine|remind|check.?in/i,
  },
  "journal-notes": {
    label: "Journal / notes",
    description: "Note list, rich editor, tags, search",
    defaultFeatures: ["Capture quick notes", "Organize with tags", "Search everything"],
    defaultScreens: ["Onboarding", "Notes", "Editor", "Search", "Profile"],
    tamaguiComponents: ["Input", "ScrollView", "Card", "Sheet", "Tabs"],
    matchApps: ["notion", "evernote", "bear", "apple notes", "day one", "obsidian"],
    matchKeywords: /note|journal|write|diary|memo|document/i,
  },
  "onboarding-heavy-utility": {
    label: "Onboarding-heavy utility",
    description: "Guided setup wizard, tool hub, contextual help",
    defaultFeatures: ["Guided setup", "Core tool workflow", "Helpful tips along the way"],
    defaultScreens: ["Onboarding", "Setup wizard", "Main tool", "Tips", "Profile"],
    tamaguiComponents: ["Sheet", "Button", "Progress", "Card", "Tooltip"],
    matchApps: ["canva", "figma", "1password", "lastpass", "google photos", "waze"],
    matchKeywords: /utility|tool|setup|wizard|scan|convert|organize photos/i,
  },
} as const;

export type LayoutArchetype = keyof typeof LAYOUT_ARCHETYPES;

export interface ReferenceInference {
  archetype: LayoutArchetype;
  features: [string, string, string];
  screens: string[];
  description: string;
}

function normalizeAppName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9 ]/g, " ");
}

const COOKING_REFERENCE =
  /allrecipe|tasty|yummly|food network|epicurious|delish|recip|mealime|sidechef|whisk/i;

const COOKING_REFERENCE_INFERENCE = (): ReferenceInference => ({
  archetype: "content-library",
  features: [
    "Snap a photo → detailed recipe",
    "Browse step-by-step recipes",
    "Build & share grocery lists",
  ],
  screens: ["Onboarding", "Home", "Recipes", "Grocery lists", "Profile"],
  description: "A cooking app with photo-to-recipe and a full recipe library.",
});

/** Map a named reference app to category + layout structure (general knowledge + archetypes). */
export function inferFromReference(
  referenceApp: string,
  twist?: string
): ReferenceInference {
  const norm = normalizeAppName(referenceApp);
  if (!norm) return defaultInference("onboarding-heavy-utility");

  if (COOKING_REFERENCE.test(norm)) {
    return applyTwistToInference(COOKING_REFERENCE_INFERENCE(), twist);
  }

  for (const [id, def] of Object.entries(LAYOUT_ARCHETYPES) as [
    LayoutArchetype,
    (typeof LAYOUT_ARCHETYPES)[LayoutArchetype],
  ][]) {
    if (def.matchApps.some((app) => norm.includes(app) || app.includes(norm))) {
      return applyTwistToInference(
        {
          archetype: id,
          features: [...def.defaultFeatures] as [string, string, string],
          screens: [...def.defaultScreens],
          description: `A ${def.label.toLowerCase()} style app inspired by the general idea behind ${referenceApp.trim()}.`,
        },
        twist
      );
    }
  }

  for (const [id, def] of Object.entries(LAYOUT_ARCHETYPES) as [
    LayoutArchetype,
    (typeof LAYOUT_ARCHETYPES)[LayoutArchetype],
  ][]) {
    if (def.matchKeywords.test(norm)) {
      return applyTwistToInference(
        {
          archetype: id,
          features: [...def.defaultFeatures] as [string, string, string],
          screens: [...def.defaultScreens],
          description: `A ${def.label.toLowerCase()} app with a similar shape to what you described.`,
        },
        twist
      );
    }
  }

  return applyTwistToInference(defaultInference("tracker-dashboard", referenceApp), twist);
}

function applyTwistToInference(
  base: ReferenceInference,
  twist?: string
): ReferenceInference {
  if (!twist?.trim()) return base;
  const userFeatures = parseUserFeatures(twist);
  return {
    ...base,
    features: mergeFeatureList(userFeatures, base.features),
    description: twist.trim(),
  };
}

function defaultInference(
  archetype: LayoutArchetype,
  referenceApp?: string
): ReferenceInference {
  const def = LAYOUT_ARCHETYPES[archetype];
  return {
    archetype,
    features: [...def.defaultFeatures] as [string, string, string],
    screens: [...def.defaultScreens],
    description: referenceApp
      ? `Your own take on a ${def.label.toLowerCase()} app — inspired by the general idea, not a copy.`
      : `A ${def.label.toLowerCase()} app built in Appable's design system.`,
  };
}

/** Pick the best archetype from full-interview answers. */
export function inferArchetypeFromInterview(
  idea: string,
  featuresRaw: string,
  audience: string
): ReferenceInference {
  const blob = `${idea} ${featuresRaw} ${audience}`;
  let best: LayoutArchetype = "onboarding-heavy-utility";
  let bestScore = 0;

  for (const [id, def] of Object.entries(LAYOUT_ARCHETYPES) as [
    LayoutArchetype,
    (typeof LAYOUT_ARCHETYPES)[LayoutArchetype],
  ][]) {
    const score = def.matchKeywords.test(blob) ? 2 : 0;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }

  if (bestScore === 0) {
    if (/recipe|food|cook|meal|kitchen/.test(blob)) best = "content-library";
    else if (/fitness|workout|gym|run/.test(blob)) best = "tracker-dashboard";
    else if (/friend|social|community|share/.test(blob)) best = "social-feed";
    else if (/shop|buy|product|store/.test(blob)) best = "marketplace-shop";
    else if (/habit|streak|daily/.test(blob)) best = "habit-streak";
    else if (/note|journal|write/.test(blob)) best = "journal-notes";
    else if (/book|schedule|appointment/.test(blob)) best = "booking-scheduling";
    else if (/swipe|match|discover/.test(blob)) best = "swipe-cards";
    else if (/chat|message|text/.test(blob)) best = "chat-messaging";
  }

  const def = LAYOUT_ARCHETYPES[best];
  const userFeatures = parseUserFeatures(featuresRaw);
  const features = mergeFeatureList(userFeatures, [...def.defaultFeatures]);

  return {
    archetype: best,
    features,
    screens: [...def.defaultScreens],
    description:
      idea ||
      featuresRaw ||
      `A ${def.label.toLowerCase()} app for ${audience || "everyday users"}.`,
  };
}

/** Normalize stored master prompts from older interviews. */
export function normalizeMasterPrompt(
  mp: MasterBuildPrompt
): MasterBuildPrompt {
  const colors = isDeferToRecommendation(mp.colors)
    ? profileFromMasterPrompt(mp).colors
    : mp.colors;
  return {
    ...mp,
    colors,
    twist: mp.twist ?? null,
    layoutArchetype: mp.layoutArchetype ?? "onboarding-heavy-utility",
    referenceApp: mp.referenceApp ?? null,
  };
}
