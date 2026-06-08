import type { LayoutArchetype } from "@/lib/archetypes";

export const SUGGEST_BATCH_LOADING_DISCOVER = [
  "Researching proven app niches…",
  "Finding patterns people actually pay for…",
  "Matching ideas to what you can build fast…",
  "Looking for the best fit for you…",
  "Pulling from apps that already work…",
] as const;

export function suggestBatchLoadingForTopic(topic: string): readonly string[] {
  const t = topic.trim();
  if (!t) return SUGGEST_BATCH_LOADING_DISCOVER;
  return [
    `Researching niches around “${t}”…`,
    "Finding the best app shapes for that…",
    "Checking what beginners can ship quickly…",
    "Looking for real-world patterns that earn…",
    "Almost there — polishing your ideas…",
  ];
}

export const DEEP_LOADING_BY_ARCHETYPE: Record<LayoutArchetype, readonly string[]> = {
  "tracker-dashboard": [
    "Mapping how you'll log progress…",
    "Sketching your stats and trends…",
    "Adding the daily flow that keeps you coming back…",
  ],
  "habit-streak": [
    "Designing your daily check-in…",
    "Setting up streaks and gentle reminders…",
    "Making it easy to show up every day…",
  ],
  "content-library": [
    "Organizing what you'll browse and save…",
    "Planning how you pick up where you left off…",
    "Laying out lessons or media you'll actually use…",
  ],
  "booking-scheduling": [
    "Mapping the book → confirm flow…",
    "Sketching calendars and time slots…",
    "Making booking feel simple for everyone…",
  ],
  "marketplace-shop": [
    "Laying out browse → cart → checkout…",
    "Planning how products are discovered…",
    "Keeping buying quick and trustworthy…",
  ],
  "social-feed": [
    "Sketching your home feed and posts…",
    "Planning how people follow and react…",
    "Making sharing feel natural…",
  ],
  "chat-messaging": [
    "Mapping inbox and conversations…",
    "Planning how messages and groups work…",
    "Keeping chat fast and familiar…",
  ],
  "swipe-cards": [
    "Designing the swipe → match flow…",
    "Sketching profiles and filters…",
    "Making discovery feel fun and clear…",
  ],
  "journal-notes": [
    "Planning your notes and tags…",
    "Sketching capture and search…",
    "Making writing feel lightweight…",
  ],
  "onboarding-heavy-utility": [
    "Walking through setup step by step…",
    "Mapping your main tool workflow…",
    "Adding tips so nothing feels confusing…",
  ],
};

export function deepLoadingLines(archetype: LayoutArchetype, appName: string): readonly string[] {
  const base = DEEP_LOADING_BY_ARCHETYPE[archetype] ?? DEEP_LOADING_BY_ARCHETYPE["tracker-dashboard"];
  return [`Breaking down “${appName}”…`, ...base];
}
