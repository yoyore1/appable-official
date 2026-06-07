import type { MasterBuildPrompt, Vibe } from "@/lib/types";

/** Lucide icon names used in tab bar + profile rows. */
export type ExpoIconName =
  | "home"
  | "chef-hat"
  | "utensils"
  | "shopping-cart"
  | "list"
  | "user"
  | "camera"
  | "heart"
  | "book-open"
  | "search"
  | "settings"
  | "bell"
  | "shield"
  | "help-circle";

export interface ExpoListItem {
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  badge?: string;
  imageUrl: string;
  /** Full detail body — recipes, articles, list notes. */
  body?: string;
  /** Recipe / shopping list ingredients with quantities. */
  ingredients?: string[];
  /** Numbered cooking or instruction steps. */
  steps?: string[];
  detailType?: "recipe" | "list" | "article" | "generic";
}

export interface ExpoHomeSection {
  title: string;
  items: ExpoListItem[];
}

export type OnboardingSlideKind = "feature_demo" | "personalization" | "value_prop" | "completion";

export interface ExpoOnboardingSlide {
  title: string;
  subtitle: string;
  imageUrl: string;
  /** Real feature this slide demonstrates — never a marketing slogan. */
  demonstrates?: string;
  /** Forward-motion CTA — e.g. "Let's cook", not generic "Get started". */
  ctaLabel?: string;
  kind?: OnboardingSlideKind;
}

export interface ExpoTab {
  id: string;
  label: string;
  icon: ExpoIconName;
}

export interface ExpoTabScreen {
  title: string;
  subtitle: string;
  items: ExpoListItem[];
}

export interface ExpoAppTheme {
  accent: string;
  cream: string;
  card: string;
  charcoal: string;
  muted: string;
  line: string;
  radius: number;
  vibe: Vibe;
  fontDisplay: string;
  fontBody: string;
}

export interface ExpoAppCapabilities {
  /** Paid live APIs — only when user asked (vision, voice, tts, etc.). */
  enabled: string[];
  /** Free in-preview UI: save_favorite, add_to_collection, share. */
  uiFeatures?: string[];
  heroAction: string;
  heroSublabel: string;
  visionPrompt: string;
}

/** Shared screen model — web preview + future Tamagui/Expo codegen source of truth. */
export interface ExpoAppModel {
  version: 1;
  category: string;
  tabs: ExpoTab[];
  onboarding: ExpoOnboardingSlide[];
  home: {
    headline: string;
    subheadline: string;
    heroLabel: string;
    heroSublabel: string;
    sections: ExpoHomeSection[];
  };
  tabScreens: Record<string, ExpoTabScreen>;
  profile: {
    displayName: string;
    tagline: string;
    stats: { label: string; value: string }[];
    settings: { label: string; icon: ExpoIconName }[];
  };
  theme: ExpoAppTheme;
  capabilities: ExpoAppCapabilities;
}

export type ExpoAppModelInput = Omit<ExpoAppModel, "theme" | "version" | "capabilities">;

export type BuildExpoContext = { masterPrompt: MasterBuildPrompt };
