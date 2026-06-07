import {
  buildOnboardingSlideSpecs,
  inferOnboardingArchetype,
  isOnboardingSlogan,
} from "@/lib/expo/onboardingPack";
import { inferAppCapabilities } from "@/lib/expo/inferCapabilities";
import type { MasterBuildPrompt } from "@/lib/types";
import type { ExpoOnboardingSlide } from "./types";
import type { AppBlueprint } from "./smartBlueprint";

/** Replace slogan onboarding with feature-demonstration slides (zero LLM). */
export function enrichOnboardingSlides(
  slides: ExpoOnboardingSlide[],
  mp: MasterBuildPrompt,
  blueprint: AppBlueprint
): ExpoOnboardingSlide[] {
  if (!slides.length) return [];
  const cap = inferAppCapabilities(mp);
  const archetype = inferOnboardingArchetype(mp);
  const specs = buildOnboardingSlideSpecs(mp, {
    archetype,
    category: blueprint.category,
    heroLabel: blueprint.hero.label,
    heroSublabel: blueprint.hero.sublabel,
    feature0: mp.features[0] ?? blueprint.features[0] ?? "Core feature",
    feature1: mp.features[1] ?? blueprint.features[1] ?? "Collection",
  });

  const base =
    slides.length >= 3
      ? slides.slice(0, 3)
      : [
          ...slides,
          ...specs.slice(slides.length).map((s) => ({
            title: s.title,
            subtitle: s.subtitle,
            imageUrl: "",
            demonstrates: s.demonstrates,
            ctaLabel: s.ctaLabel,
            kind: s.kind,
          })),
        ].slice(0, 3);

  return base.map((slide, i) => {
    const spec = specs[i] ?? specs[specs.length - 1];
    const slogan = isOnboardingSlogan(slide.title, slide.subtitle);
    return {
      ...slide,
      title: slogan ? spec.title : slide.title || spec.title,
      subtitle: slogan ? spec.subtitle : slide.subtitle || spec.subtitle,
      demonstrates: slide.demonstrates ?? spec.demonstrates,
      ctaLabel: slide.ctaLabel ?? spec.ctaLabel,
      kind: slide.kind ?? spec.kind,
      imageUrl: slide.imageUrl,
    };
  });
}
