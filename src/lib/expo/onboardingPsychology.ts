import type { AppCategory } from "@/lib/expoApp/inferCategory";
import type { MasterBuildPrompt } from "@/lib/types";
import {
  ONBOARDING_ARCHETYPE_GUIDE,
  onboardingPackForPrompt,
} from "./onboardingPack";
import { premiumPolishForPrompt, TOP_PREMIUM_LEVERS } from "./premiumPolish";

/**
 * Onboarding psychology + premium polish baked into generated apps.
 * Mirrors appable-onboarding-polish.md — injected into Expo content generator.
 */
export const ONBOARDING_PSYCHOLOGY_RULES = `
ONBOARDING PACK (mandatory — libraries, not free-style):
- Carousel: react-native-onboarding-swiper OR react-native-app-intro-slider
- Illustrations: lottie-react-native (LottieFiles) — animated, NOT static stock + slogans
- Motion: moti + react-native-reanimated (staggered reveals, parallax)
- Backgrounds: expo-linear-gradient on onboarding screens

ARCHETYPES (master prompt picks one):
- show-the-magic-first — real core result before explaining (photo→X apps)
- value-prop-carousel — each slide = ONE feature demo + Lottie
- personalization-first — quick taps, choices visibly applied
- hybrid — personalize then show magic

HARD RULE — show the feature, NEVER a slogan:
- BAD: "Snap. Cook. Smile." / "Welcome to X" / "You're all set"
- GOOD: "Tap scan → see ingredients + steps appear" / "Watch your 5-day streak fill in"
- Every slide must DEMONSTRATE this app's actual feature (field: demonstrates)

PSYCHOLOGY (map to archetype):
- Quick win / aha fast
- Investment / small early choices matter
- Personalization payoff visible on next screen
- Seeded social proof (realistic stats, never empty)
- Progress + completion (forward CTAs; soft confetti on finish)
- Upgrades = "level up" not a wall
`.trim();

export const PREMIUM_POLISH_RULES = `
PREMIUM POLISH (free on-device — use with RESTRAINT):
Visual: expo-linear-gradient, expo-blur (frosted sheets/tab bar), react-native-svg
Motion: lottie-react-native, reanimated springs, moti stagger, gesture-handler, expo-haptics on EVERY interaction
Details: shimmer/skeleton loaders (never blank/spinner), @gorhom/bottom-sheet, @shopify/flash-list, lucide-react-native

TOP 3 LEVERS (prioritize):
${TOP_PREMIUM_LEVERS.map((l) => `- ${l}`).join("\n")}

Preview mimics with CSS motion + confetti; device build uses full stack above.
`.trim();

export function psychologyHintsFor(
  mp: MasterBuildPrompt,
  category: AppCategory = "general"
): string[] {
  const pack = onboardingPackForPrompt(mp);
  const hints: string[] = [
    `Onboarding archetype: ${pack.archetype} — ${ONBOARDING_ARCHETYPE_GUIDE[pack.archetype]}`,
    ...pack.hardRules,
  ];

  pack.slideSpecs.forEach((s, i) => {
    hints.push(
      `Onboarding slide ${i + 1} [${s.kind}]: title "${s.title}" — must demonstrate: ${s.demonstrates}`
    );
  });

  const blob = mp.description + mp.features.join(" ");
  if (category === "cooking" && /recipe|cook|food|meal|kitchen/.test(blob)) {
    hints.push(
      "Cooking: onboarding slide 1 should show camera/scan → real recipe result, not a tagline."
    );
  }
  if (category === "pets") {
    hints.push(
      "Pets: onboarding slide 1 shows posting or browsing a walk request — real breed/area/budget on screen."
    );
  }
  if (/photo|camera|snap|scan/.test(blob)) {
    hints.push("Show-the-magic-first: first slide previews the actual scan/photo result flow.");
  }
  if (mp.twist) {
    hints.push(`Weave twist into slide 3: "${mp.twist.slice(0, 80)}".`);
  }
  if (mp.audience) {
    hints.push(`Personalization slide references: ${mp.audience.slice(0, 60)}.`);
  }
  hints.push('Profile stats: "142 saved · 89 this month" — specific, not round zeros.');
  return hints;
}

export function onboardingContextFor(mp: MasterBuildPrompt) {
  const pack = onboardingPackForPrompt(mp);
  const polish = premiumPolishForPrompt(mp);
  return { onboardingPack: pack, premiumPolish: polish };
}
