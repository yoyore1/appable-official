import type { MasterBuildPrompt } from "@/lib/types";
import { inferAppCapabilities } from "./inferCapabilities";

export type OnboardingArchetype =
  | "show-the-magic-first"
  | "value-prop-carousel"
  | "personalization-first"
  | "hybrid";

export type OnboardingSlideKind = "feature_demo" | "personalization" | "value_prop" | "completion";

export interface OnboardingSlideSpec {
  title: string;
  subtitle: string;
  demonstrates: string;
  ctaLabel: string;
  kind: OnboardingSlideKind;
}

/** Free on-device libraries — onboarding carousel + motion (codegen hints). */
export const ONBOARDING_LIBRARIES = [
  "react-native-onboarding-swiper OR react-native-app-intro-slider — carousel, dots, skip/next",
  "lottie-react-native — animated onboarding illustrations (lottiefiles.com, not static slogans)",
  "moti + react-native-reanimated — staggered reveals, parallax between slides",
  "expo-linear-gradient — gradient backgrounds on onboarding screens",
] as const;

export const ONBOARDING_ARCHETYPE_GUIDE: Record<OnboardingArchetype, string> = {
  "show-the-magic-first":
    "Drop user into core action — show a REAL result before explaining (photo→recipe, scan→result).",
  "value-prop-carousel":
    "2–3 screens, each demonstrating ONE real feature with Lottie or live preview — never a slogan.",
  "personalization-first":
    "Quick preference taps so the app feels custom from screen one (investment effect).",
  hybrid: "Quick personalization, then show the magic on the final slide.",
};

const SLOGAN_TITLE =
  /^(snap\.?\s*cook|welcome to|you'?re all set|good to see you|let'?s go|hello|hi there)/i;
const SLOGAN_SUBTITLE =
  /^(your rules|built around|your .+ space is ready|we turn|photograph what)/i;

export function isOnboardingSlogan(title: string, subtitle: string): boolean {
  const t = title.trim();
  const s = subtitle.trim();
  if (SLOGAN_TITLE.test(t)) return true;
  if (t.split(/\s+/).length <= 4 && /[.!]/.test(t) && !/\d|step|tap|→|->|recipe|workout|task|cart/i.test(s)) {
    return true;
  }
  if (SLOGAN_SUBTITLE.test(s) && !/you'll see|watch|try|tap|open|scan|add|save/i.test(s)) {
    return true;
  }
  return false;
}

export function inferOnboardingArchetype(mp: MasterBuildPrompt): OnboardingArchetype {
  const blob = [mp.description, mp.audience, mp.twist ?? "", ...mp.features].join(" ");
  const cap = inferAppCapabilities(mp);
  if (
    cap.capabilities.includes("vision_ai") ||
    /photo|camera|snap|scan|magic|instant|wow/.test(blob)
  ) {
    return "show-the-magic-first";
  }
  if (/personal|preference|dietary|taste|level|goal|habit|custom|tailor/.test(blob)) {
    return /photo|camera|scan|instant/.test(blob) ? "hybrid" : "personalization-first";
  }
  if (/track|streak|habit|todo|task|plan/.test(blob)) {
    return "personalization-first";
  }
  return "value-prop-carousel";
}

function completionCta(mp: MasterBuildPrompt, category: string): string {
  const f0 = mp.features[0]?.toLowerCase() ?? "";
  if (/cook|recipe|food/.test(category + f0)) return "Let's cook";
  if (/workout|fitness|train/.test(category + f0)) return "Start training";
  if (/task|todo|productiv/.test(category + f0)) return "Open my tasks";
  if (/shop|cart|deal/.test(category + f0)) return "Browse deals";
  if (/learn|lesson|course/.test(category + f0)) return "Start learning";
  return `Try ${mp.features[0] ?? "it"}`;
}

/** Feature-demonstration slides — never generic slogans. */
export function buildOnboardingSlideSpecs(
  mp: MasterBuildPrompt,
  opts: {
    archetype: OnboardingArchetype;
    category: string;
    heroLabel: string;
    heroSublabel: string;
    feature0: string;
    feature1: string;
  }
): OnboardingSlideSpec[] {
  const aud = mp.audience.split(/[,;]/)[0]?.trim() ?? mp.audience;
  const { archetype, category, heroLabel, heroSublabel, feature0, feature1 } = opts;
  const done = completionCta(mp, category);

  if (archetype === "show-the-magic-first") {
    return [
      {
        kind: "feature_demo",
        title: `See ${feature0} in action`,
        subtitle: `Tap ${heroLabel.toLowerCase()} — ${heroSublabel}. You'll get a real result on screen one, not a tutorial.`,
        demonstrates: feature0,
        ctaLabel: "Show me",
      },
      {
        kind: "value_prop",
        title: feature1 || "Save and organize",
        subtitle: `Everything lands in the right tab — built for ${aud.toLowerCase()}. Watch how ${feature1 || "your library"} connects to home.`,
        demonstrates: feature1 || mp.features[1] || "collection",
        ctaLabel: "Next",
      },
      {
        kind: "completion",
        title: "You're ready",
        subtitle: `Profile stats, save, and settings already work. ${mp.twist ? mp.twist.slice(0, 80) : `Jump into ${feature0.toLowerCase()}.`}`,
        demonstrates: "full app preview",
        ctaLabel: done,
      },
    ];
  }

  if (archetype === "personalization-first") {
    return [
      {
        kind: "personalization",
        title: "Set your defaults",
        subtitle: `Two taps — spice, portions, goals, or focus style — so ${mp.appName} matches how ${aud.toLowerCase()} actually works.`,
        demonstrates: "preferences",
        ctaLabel: "Choose preferences",
      },
      {
        kind: "feature_demo",
        title: feature0,
        subtitle: `Here's what ${feature0.toLowerCase()} looks like with your choices applied — real cards, real steps.`,
        demonstrates: feature0,
        ctaLabel: "See it work",
      },
      {
        kind: "completion",
        title: "Your space is ready",
        subtitle: `${feature1 || feature0} is one tap from home. Stats show believable activity — not empty shells.`,
        demonstrates: feature1 || feature0,
        ctaLabel: done,
      },
    ];
  }

  if (archetype === "hybrid") {
    return [
      {
        kind: "personalization",
        title: "Quick setup",
        subtitle: `Pick what matters to ${aud.toLowerCase()} — diet, level, or focus — takes 10 seconds.`,
        demonstrates: "personalization",
        ctaLabel: "Set up",
      },
      {
        kind: "feature_demo",
        title: heroLabel,
        subtitle: heroSublabel,
        demonstrates: feature0,
        ctaLabel: "See the result",
      },
      {
        kind: "completion",
        title: feature1 || feature0,
        subtitle: `${feature1 || "Your second core feature"} links to tabs and lists — try save + collection in the preview.`,
        demonstrates: feature1 || feature0,
        ctaLabel: done,
      },
    ];
  }

  // value-prop-carousel (default)
  return [
    {
      kind: "feature_demo",
      title: feature0,
      subtitle: `See how ${feature0.toLowerCase()} works — open a card, check the details, save in one tap.`,
      demonstrates: feature0,
      ctaLabel: "Next",
    },
    {
      kind: "value_prop",
      title: feature1 || `Built for ${aud}`,
      subtitle: `${feature1 || mp.features[1] || "Collection tab"} items reference real content from home — you'll see names, not placeholders.`,
      demonstrates: feature1 || "linked collection",
      ctaLabel: "Next",
    },
    {
      kind: "completion",
      title: "Go explore",
      subtitle: `Haptics, motion, and sheets in the full app. Preview: tap cards, profile settings, and ${heroLabel.toLowerCase()}.`,
      demonstrates: "navigation + profile",
      ctaLabel: done,
    },
  ];
}

export function onboardingPackForPrompt(mp: MasterBuildPrompt): {
  archetype: OnboardingArchetype;
  archetypeGuide: string;
  libraries: string[];
  slideSpecs: OnboardingSlideSpec[];
  hardRules: string[];
} {
  const archetype = inferOnboardingArchetype(mp);
  const cap = inferAppCapabilities(mp);
  const category = mp.description + mp.features.join(" ");
  const slideSpecs = buildOnboardingSlideSpecs(mp, {
    archetype,
    category,
    heroLabel: cap.heroAction,
    heroSublabel: cap.heroSublabel,
    feature0: mp.features[0] ?? "Core feature",
    feature1: mp.features[1] ?? "Your library",
  });

  return {
    archetype,
    archetypeGuide: ONBOARDING_ARCHETYPE_GUIDE[archetype],
    libraries: [...ONBOARDING_LIBRARIES],
    slideSpecs,
    hardRules: [
      "HARD RULE: every slide DEMONSTRATES a real feature — generic slogans = failed onboarding.",
      "Use Lottie animations in codegen — not static stock + taglines.",
      "CTAs feel like forward motion (e.g. Let's cook) — not bare Get started.",
      "Onboarding critique: aha fast, specific to THIS app, animated illustrations.",
    ],
  };
}
