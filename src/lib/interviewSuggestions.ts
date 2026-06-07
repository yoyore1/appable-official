import { profileFromInterview, recommendDesignProfile } from "@/lib/designResearch";
import { hasDetailedFlow } from "@/lib/dynamicInterview";
import { answerFor, interviewContext, suggestAppNameFromIdea } from "@/lib/interviewHelpers";
import {
  detectInterviewNiche,
  ideaTailoredSuggestions,
} from "@/lib/interviewUnderstanding";

export { hasDetailedFlow };
import type { InterviewStepId } from "@/lib/interviewFlow";
import type { InterviewTurn } from "@/lib/types";

/** Shown as the last pill on every spine question. */
export const APPABLE_PICK = "Let Appable pick";

type AppCategory =
  | "dog-pets"
  | "marketplace"
  | "fitness"
  | "food"
  | "travel"
  | "booking"
  | "habits"
  | "finance"
  | "social"
  | "generic";

function ctx(interview: InterviewTurn[]): string {
  return interviewContext(interview).toLowerCase();
}

function detectCategory(interview: InterviewTurn[]): AppCategory {
  const niche = detectInterviewNiche(interview);
  if (niche === "alarm-wake") return "habits";

  const c = ctx(interview);
  if (/dog|pet|puppy|paw|walker|walk your|dog walk|dog owner/.test(c)) {
    return "dog-pets";
  }
  if (/connect|match|marketplace|apply|gig|freelance|local|nearby|area/.test(c)) {
    return "marketplace";
  }
  if (/recipe|food|cook|meal|kitchen|dish|ingredient|grocery/.test(c)) return "food";
  if (/fitness|workout|gym|health|run|exercise/.test(c)) return "fitness";
  if (/flight|travel|trip|hotel|vacation/.test(c)) return "travel";
  if (/book|appointment|schedule|calendar|reserv/.test(c)) return "booking";
  if (/habit|streak|routine|daily|journal/.test(c)) return "habits";
  if (/finance|money|budget|bank|invest|expense/.test(c)) return "finance";
  if (/social|chat|friend|community|dating|message/.test(c)) return "social";
  return "generic";
}

export function isAppablePick(answer: string): boolean {
  const a = answer.trim().toLowerCase();
  if (a === APPABLE_PICK.toLowerCase()) return true;
  return /recommend|you think|pick for me|your call|surprise me|idk|don't know|no preference|suggest one|name it/i.test(
    a
  );
}

export function recommendAudience(interview: InterviewTurn[]): string {
  const cat = detectCategory(interview);
  const idea = answerFor(interview, "idea");
  if (detectInterviewNiche(interview) === "alarm-wake") {
    return "Heavy snoozers and early-shift workers who need a real wake-up";
  }

  const byCat: Record<AppCategory, string> = {
    "dog-pets":
      "Dog owners who need walks + walkers looking for gigs in their neighborhood",
    marketplace:
      "People offering a service locally + people nearby who need it",
    food: "Home cooks and busy parents who want quick, reliable meal help",
    fitness: "People who work out regularly and want simple progress tracking",
    travel: "Travelers who compare trips and want the best flight deals fast",
    booking: "Busy people who book appointments without phone tag",
    habits: "People building daily routines who need gentle accountability",
    finance: "Everyday earners who want a clear picture of their money",
    social: "People who want to connect around a shared interest locally",
    generic: "Everyday people who want something simple and actually useful",
  };

  if (idea.length > 20 && /owner|walker|both|provider|customer/.test(idea.toLowerCase())) {
    return byCat[cat];
  }
  return byCat[cat];
}

export function recommendFeatures(interview: InterviewTurn[]): string {
  const cat = detectCategory(interview);
  if (detectInterviewNiche(interview) === "alarm-wake") {
    return "Set alarm → must snap outside/sun photo to stop, no snooze, wake streaks";
  }

  const byCat: Record<AppCategory, string> = {
    "dog-pets":
      "Post breed, area & pay → walkers apply, match both ways, in-app chat & walk history",
    marketplace:
      "Post what you need locally, browse & apply, match both ways with messaging",
    food: "Save & browse recipes, step-by-step cooking mode, grocery list from ingredients",
    fitness: "Log workouts fast, progress charts, weekly streaks & reminders",
    travel: "Search & compare flights, save trips, price alerts for dates you care about",
    booking: "Pick a time slot, confirm in one tap, reminders & easy rescheduling",
    habits: "Daily check-ins, streak tracking, simple charts for momentum",
    finance: "Track spending by category, monthly budgets, clear snapshot dashboard",
    social: "Discover nearby people, chat, save favorites & get notified on matches",
    generic:
      "Core action in one tap, clear home dashboard, save history & simple profile",
  };

  return byCat[cat];
}

export function recommendName(interview: InterviewTurn[]): string {
  const idea = answerFor(interview, "idea");
  const c = ctx(interview);

  if (/dog|pet|walk|walker|paw/.test(c)) {
    const names = ["PawPath", "WalkMatch", "Neighborhood Paws"];
    let h = 0;
    for (const ch of idea) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return names[Math.abs(h) % names.length];
  }
  if (/recipe|food|cook/.test(c) && /photo|snap|camera/.test(c)) return "SnapChef";
  if (/habit|streak/.test(c)) return "Streakly";
  if (/flight|travel/.test(c)) return "Tripwise";
  if (/book|appointment/.test(c)) return "Slotly";

  return suggestAppNameFromIdea(idea);
}

function audienceSuggestions(interview: InterviewTurn[]): string[] {
  const tailored = ideaTailoredSuggestions("audience", interview);
  if (tailored) return [...tailored, APPABLE_PICK];

  const cat = detectCategory(interview);
  const byCat: Record<AppCategory, string[]> = {
    "dog-pets": [
      "Busy dog owners who need walks",
      "Dog walkers looking for local gigs",
      "Both owners & walkers in the same area",
    ],
    marketplace: [
      "People who need help nearby",
      "Freelancers offering local services",
      "Both sides — customers & providers",
    ],
    food: ["Home cooks learning new dishes", "Busy parents meal planning", "College students on a budget"],
    fitness: ["Gym regulars tracking progress", "Beginners starting a routine", "Runners logging miles"],
    travel: ["Frequent flyers comparing deals", "Families planning vacations", "Solo travelers on a budget"],
    booking: ["Busy professionals", "Salon & clinic clients", "Anyone who hates phone tag"],
    habits: ["People building morning routines", "Students staying consistent", "Anyone quitting a bad habit"],
    finance: ["Young adults budgeting", "Couples tracking shared expenses", "Freelancers with variable income"],
    social: ["Locals with shared hobbies", "New people in town", "Community around one niche"],
    generic: ["Busy everyday users", "Beginners who want it simple", "Power users who want control"],
  };
  return [...byCat[cat], APPABLE_PICK];
}

function featuresSuggestions(interview: InterviewTurn[]): string[] {
  const tailored = ideaTailoredSuggestions("features", interview);
  if (tailored) return [...tailored, APPABLE_PICK];

  const cat = detectCategory(interview);
  const byCat: Record<AppCategory, string[]> = {
    "dog-pets": [
      "Post breed, area & pay → walkers apply",
      "Browse nearby requests & match both ways",
      "Chat, walk history & in-app payments",
    ],
    marketplace: [
      "Post a request with location & budget",
      "Browse listings & apply to jobs",
      "Match both ways + messaging",
    ],
    food: [
      "Browse & save recipes",
      "Step-by-step cook mode",
      "Auto grocery list from ingredients",
    ],
    fitness: ["Quick workout logging", "Progress charts & PRs", "Streaks & reminders"],
    travel: ["Search & compare flights", "Save trips & dates", "Price drop alerts"],
    booking: ["Pick a time slot", "One-tap confirm & reminders", "Reschedule without calling"],
    habits: ["Daily check-in", "Streak counter", "Weekly progress chart"],
    finance: ["Track spending by category", "Monthly budget caps", "Simple dashboard snapshot"],
    social: ["Discover nearby profiles", "In-app chat", "Save favorites & alerts"],
    generic: ["One-tap core action", "Clean home dashboard", "History & profile"],
  };
  return [...byCat[cat], APPABLE_PICK];
}

function nameSuggestions(interview: InterviewTurn[]): string[] {
  const cat = detectCategory(interview);
  const idea = answerFor(interview, "idea");
  const primary = recommendName(interview);

  const altByCat: Record<AppCategory, string[]> = {
    "dog-pets": ["PawPath", "WalkMatch", "Neighborhood Paws"],
    marketplace: ["LocalLink", "MatchMint", "NearBid"],
    food: ["SnapChef", "DishLink", "PantryPal"],
    fitness: ["FitFlow", "RepTrack", "StreakGym"],
    travel: ["Tripwise", "SkyHop", "FareFind"],
    booking: ["Slotly", "BookEase", "CalmCal"],
    habits: ["Streakly", "DailyFlow", "HabitHue"],
    finance: ["PocketPlan", "ClearLedger", "BudgetBloom"],
    social: ["CircleUp", "Nearby", "HiveLocal"],
    generic: [primary, suggestAppNameFromIdea(idea), "Appable"],
  };

  const alts = altByCat[cat].filter((n, i, arr) => arr.indexOf(n) === i);
  const picks = alts.slice(0, 3);
  while (picks.length < 2) picks.push(suggestAppNameFromIdea(idea));
  return [...picks.slice(0, 3), APPABLE_PICK];
}

function colorSuggestions(interview: InterviewTurn[]): string[] {
  const c = ctx(interview);
  const rec = recommendDesignProfile(c).colorsShort;

  if (/dog|pet|walk|walker|paw/.test(c)) {
    return ["Forest green & warm cream", "Sky blue & soft sand", rec, APPABLE_PICK];
  }
  if (/recipe|food|cook|meal|kitchen/.test(c)) {
    return [rec, "Terracotta & soft white", "Sage & warm cream", APPABLE_PICK];
  }
  if (/fitness|workout|gym/.test(c)) {
    return ["Electric teal & charcoal", "Coral energy & off-white", rec, APPABLE_PICK];
  }
  if (/finance|money|budget/.test(c)) {
    return ["Deep navy & gold", "Forest green & cream", rec, APPABLE_PICK];
  }
  if (/social|chat|connect|match/.test(c)) {
    return ["Coral & warm sand", "Lavender & cream", rec, APPABLE_PICK];
  }
  return [rec, "Coral & warm cream", "Sage & soft white", APPABLE_PICK];
}

function ideaSuggestions(): string[] {
  return [
    "Local marketplace — match people by area",
    "Daily habit tracker with streaks",
    "Book appointments without the hassle",
    APPABLE_PICK,
  ];
}

function isDynamicStep(stepId: string): boolean {
  return stepId.startsWith("followup_");
}

function followupIdeaSuggestions(interview: InterviewTurn[]): string[] {
  const c = ctx(interview);
  if (/dog|pet|walk|walker/.test(c)) {
    return [
      "Open app → post walk request → matched walker shows up",
      "Browse nearby walks → apply → owner accepts you",
      "Set your area & rates → get notified for new walks",
      APPABLE_PICK,
    ];
  }
  if (/recipe|food|cook|photo|snap/.test(c)) {
    return [
      "Snap a dish → get ingredients & steps instantly",
      "Browse saved recipes → tap cook mode",
      "Upload pantry photo → recipe ideas appear",
      APPABLE_PICK,
    ];
  }
  return [
    "Open app → do the core action in one tap",
    "Land on home → pick what you need → done",
    "Sign up → guided first task in under a minute",
    APPABLE_PICK,
  ];
}

function followupFeaturesSuggestions(interview: InterviewTurn[]): string[] {
  const c = ctx(interview);
  if (/dog|pet|walk|walker|breed/.test(c)) {
    return [
      "Owner posts breed & pay → walkers apply → match → chat → walk done",
      "Walker sets area → sees requests → applies → owner picks → walk",
      "Either side posts → other browses → match → in-app chat & history",
      APPABLE_PICK,
    ];
  }
  return [
    "Open → pick action → confirm → see result on home",
    "Post what you need → others respond → pick one → message",
    "Tap main button → fill quick form → done in one flow",
    APPABLE_PICK,
  ];
}

function followupRecipeDepthSuggestions(interview: InterviewTurn[]): string[] {
  const c = ctx(interview);
  if (/dog|pet|walk|walker|breed/.test(c)) {
    return [
      "Require breed, area & pay before walkers can apply",
      "Walkers must verify ID; owners see walk history",
      "Optional notes field — keep booking form minimal",
      APPABLE_PICK,
    ];
  }
  if (/recipe|food|cook|meal|kitchen/.test(c)) {
    return [
      "Full step-by-step + ingredient amounts required",
      "Photo optional — short text recipe is fine",
      "Skip nutrition unless user expands details",
      APPABLE_PICK,
    ];
  }
  if (/book|appointment|schedule/.test(c)) {
    return [
      "Name + time slot required; everything else optional",
      "Cancel within 24h — no penalty",
      "Providers set required fields per service type",
      APPABLE_PICK,
    ];
  }
  return [
    "Keep signup to 3 fields max",
    "Core action works without an account first",
    "Require photo proof only for trust-critical steps",
    APPABLE_PICK,
  ];
}

/** @deprecated Pills come from LLM via interviewSuggestionsForStep — not category lists. */
export function suggestForStep(
  _stepId: InterviewStepId,
  _interview: InterviewTurn[]
): string[] {
  return [APPABLE_PICK];
}

/** Idea-tailored pills when the LLM returns junk — still uses their interview, not generic copy. */
export function fallbackSuggestionsForStep(
  stepId: InterviewStepId,
  interview: InterviewTurn[]
): string[] {
  const tailored = ideaTailoredSuggestions(stepId, interview);
  if (tailored?.length) return [...tailored, APPABLE_PICK];

  switch (stepId) {
    case "audience":
      return audienceSuggestions(interview);
    case "features":
      return featuresSuggestions(interview);
    case "name":
      return nameSuggestions(interview);
    case "colors":
      return colorSuggestions(interview);
    case "idea":
      return ideaSuggestions();
    case "followup_idea":
      return followupIdeaSuggestions(interview);
    case "followup_features":
      return followupFeaturesSuggestions(interview);
    case "followup_recipe_depth":
      return followupRecipeDepthSuggestions(interview);
    case "followup_clarify_idea":
    case "followup_clarify_audience":
    case "followup_clarify_features":
    case "pool_who":
    case "pool_core_loop":
    case "pool_rules":
    case "pool_proof":
    case "pool_first_use":
      return ideaTailoredSuggestions(stepId, interview)
        ? [...(ideaTailoredSuggestions(stepId, interview) ?? []), APPABLE_PICK]
        : [APPABLE_PICK];
    default:
      return [APPABLE_PICK];
  }
}

/** Expand “Let Appable pick” into a real stored answer. */
export function resolveInterviewAnswer(
  stepId: InterviewStepId,
  answer: string,
  interview: InterviewTurn[]
): string {
  const trimmed = answer.trim();
  if (!isAppablePick(trimmed)) return trimmed;

  switch (stepId) {
    case "audience":
    case "pool_who":
      return recommendAudience(interview);
    case "features":
    case "pool_core_loop":
      return recommendFeatures(interview);
    case "pool_rules":
    case "pool_proof":
      return (
        fallbackSuggestionsForStep(stepId, interview).find(
          (s) => s !== APPABLE_PICK
        ) ?? trimmed
      );
    case "pool_first_use":
      return (
        fallbackSuggestionsForStep("followup_idea", interview).find(
          (s) => s !== APPABLE_PICK
        ) ?? trimmed
      );
    case "name":
      return recommendName(interview);
    case "colors":
      return profileFromInterview(interview).colorsShort;
    case "followup_idea":
    case "followup_features":
    case "followup_recipe_depth":
    case "followup_clarify_idea":
    case "followup_clarify_audience":
    case "followup_clarify_features":
      return (
        fallbackSuggestionsForStep(stepId, interview).find(
          (s) => s !== APPABLE_PICK
        ) ?? trimmed
      );
    case "idea":
      return trimmed;
    default:
      return trimmed;
  }
}
