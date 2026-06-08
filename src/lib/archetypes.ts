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
    matchKeywords:
      /book|schedule|appointment|reserve|calendar|slot|delivery|ride|dog walk|walker|pet sit|walk request/i,
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

/** Alternate patterns so landing “Suggest ideas” can offer 3 distinct app shapes. */
const ARCHETYPE_ALTERNATES: Record<LayoutArchetype, LayoutArchetype[]> = {
  "tracker-dashboard": ["habit-streak", "content-library", "journal-notes"],
  "habit-streak": ["tracker-dashboard", "content-library", "journal-notes"],
  "content-library": ["habit-streak", "tracker-dashboard", "journal-notes"],
  "booking-scheduling": ["tracker-dashboard", "chat-messaging", "marketplace-shop"],
  "marketplace-shop": ["swipe-cards", "content-library", "booking-scheduling"],
  "social-feed": ["chat-messaging", "swipe-cards", "content-library"],
  "chat-messaging": ["social-feed", "booking-scheduling", "tracker-dashboard"],
  "swipe-cards": ["social-feed", "marketplace-shop", "booking-scheduling"],
  "journal-notes": ["tracker-dashboard", "habit-streak", "content-library"],
  "onboarding-heavy-utility": ["tracker-dashboard", "content-library", "habit-streak"],
};

function displayAppName(slug: string): string {
  const known: Record<string, string> = {
    strava: "Strava",
    myfitnesspal: "MyFitnessPal",
    fitbit: "Fitbit",
    duolingo: "Duolingo",
    instagram: "Instagram",
    tiktok: "TikTok",
    tinder: "Tinder",
    airbnb: "Airbnb",
    calendly: "Calendly",
    spotify: "Spotify",
    netflix: "Netflix",
    notion: "Notion",
    uber: "Uber",
    doordash: "DoorDash",
    whatsapp: "WhatsApp",
    amazon: "Amazon",
    etsy: "Etsy",
    headspace: "Headspace",
    yelp: "Yelp",
  };
  const key = slug.toLowerCase();
  if (known[key]) return known[key]!;
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export interface PlaybookSlot {
  archetype: LayoutArchetype;
  label: string;
  patternHint: string;
  features: string[];
  referenceApp: string;
  /** First two slots use “Like X for Y”; third is original. */
  useLikeComparison: boolean;
  /** Narrow topic angle for this card (discover + similar). */
  nicheTopic?: string;
  nicheLabel?: string;
}

const DISCOVER_BATCHES: { nicheLabel: string; topic: string }[][] = [
  [
    { nicheLabel: "Fitness & habits", topic: "home gym and workouts" },
    { nicheLabel: "Pets & local services", topic: "dog walking for busy pet owners" },
    { nicheLabel: "Money & food", topic: "budgeting and weekly meal prep" },
  ],
  [
    { nicheLabel: "Cooking", topic: "easy home cooking and recipes" },
    { nicheLabel: "Daily habits", topic: "building daily habits and streaks" },
    { nicheLabel: "Local booking", topic: "booking tutors or nail appointments" },
  ],
  [
    { nicheLabel: "Journaling", topic: "daily journaling and reflection" },
    { nicheLabel: "Selling online", topic: "selling handmade or vintage goods" },
    { nicheLabel: "Mindfulness", topic: "meditation and calm daily check-ins" },
  ],
];

function slotFromArchetype(
  archetype: LayoutArchetype,
  index: number,
  nicheTopic?: string,
  nicheLabel?: string
): PlaybookSlot {
  const def = LAYOUT_ARCHETYPES[archetype];
  const refSlug = def.matchApps[0] ?? "a popular app";
  return {
    archetype,
    label: def.label,
    patternHint: def.description,
    features: [...def.defaultFeatures],
    referenceApp: displayAppName(refSlug),
    useLikeComparison: index < 2,
    nicheTopic,
    nicheLabel,
  };
}

/** Lost-user discovery: 3 quality ideas in 3 different niches. */
export function pickDiscoverSlots(variant = 0): PlaybookSlot[] {
  const batch = DISCOVER_BATCHES[variant % DISCOVER_BATCHES.length]!;
  return batch.map((row, index) => {
    const inferred = inferArchetypeFromInterview(row.topic, "", "");
    return slotFromArchetype(
      inferred.archetype,
      index,
      row.topic,
      row.nicheLabel
    );
  });
}

/** Three proven app patterns for a landing-page topic (e.g. gym → tracker + streak + library). */
export function pickPlaybookSlotsForTopic(topic: string, variant = 0): PlaybookSlot[] {
  const primary = inferArchetypeFromInterview(topic.trim(), "", "");
  const baseAlts = ARCHETYPE_ALTERNATES[primary.archetype] ?? [
    "habit-streak",
    "content-library",
  ];
  const shift = ((variant % baseAlts.length) + baseAlts.length) % baseAlts.length;
  const alts = [...baseAlts.slice(shift), ...baseAlts.slice(0, shift)];
  const ids: LayoutArchetype[] = [primary.archetype];
  if (variant > 0 && alts[0]) {
    ids[0] = alts[0]!;
  }
  for (const alt of alts) {
    if (!ids.includes(alt)) ids.push(alt);
    if (ids.length >= 3) break;
  }
  for (const id of Object.keys(LAYOUT_ARCHETYPES) as LayoutArchetype[]) {
    if (ids.length >= 3) break;
    if (!ids.includes(id)) ids.push(id);
  }

  const topicAngle = topic.trim();
  return ids.slice(0, 3).map((id, index) =>
    slotFromArchetype(id, index, topicAngle || undefined)
  );
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
    if (/dog|pet|walk|walker|sitter|paw/.test(blob)) best = "booking-scheduling";
    else if (/recipe|food|cook|meal|kitchen/.test(blob)) best = "content-library";
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
