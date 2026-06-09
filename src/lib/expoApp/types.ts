import type { CapabilityAuditSnapshot } from "./capabilities/types";
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
  /** Small chips — breed, size, status. */
  tags?: string[];
  /** Owner note or pull quote on cards. */
  quote?: string;
  /** Primary CTA on card/detail — e.g. Accept Walk, Book, Save. */
  primaryAction?: string;
  /** Dual-role apps: which role sees this item (owner, walker, buyer, …). */
  forRole?: string;
  /** Full detail body — recipes, articles, list notes. */
  body?: string;
  /** Recipe / shopping list ingredients with quantities. */
  ingredients?: string[];
  /** Numbered cooking or instruction steps. */
  steps?: string[];
  detailType?: "recipe" | "list" | "article" | "generic";
}

export interface ExpoUserRole {
  id: string;
  label: string;
  description: string;
  emoji?: string;
}

export interface ExpoSetupField {
  id: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  kind?: "text" | "textarea" | "select";
  options?: string[];
  section?: string;
}

/** Sign-up / sign-in screen in the web preview — wired to Supabase when connected. */
export interface ExpoAuthFlow {
  enabled: boolean;
  /** Use linked Supabase project for real sign-up (anon client). */
  liveSupabase?: boolean;
  signUpTitle: string;
  signUpSubtitle?: string;
  /** Primary CTA on the sign-up tab. */
  submitLabel: string;
  signInTitle: string;
  signInSubtitle?: string;
  /** Primary CTA on the sign-in tab. */
  signInSubmitLabel: string;
  captureName: boolean;
  /** Owner / walker on the same screen as email + password. */
  captureRoleInSignUp: boolean;
  /** Shown above email form — default on when auth is enabled. */
  showGoogleSignIn?: boolean;
  showAppleSignIn?: boolean;
}

/** First-launch flow before main tabs — role pick + profile wizard. */
export interface ExpoAppFlow {
  welcomeTitle?: string;
  welcomeSubtitle?: string;
  roles?: ExpoUserRole[];
  setupTitle?: string;
  setupSubtitle?: string;
  /** Primary CTA on the profile setup wizard. */
  setupSubmitLabel?: string;
  setupFields?: ExpoSetupField[];
  auth?: ExpoAuthFlow;
}

export interface ExpoBuildRecap {
  headline: string;
  sections: { title: string; bullets: string[] }[];
  suggestedNext?: string;
}

/** How a primaryAction button behaves in the web preview (Kimi-authored per app). */
export type PreviewActionKind =
  | "open_detail"
  | "compose_message"
  | "update_status"
  | "navigate_tab"
  | "save";

export interface PreviewActionRule {
  /** Matches primaryAction label (case-insensitive contains). */
  match: string;
  kind: PreviewActionKind;
  toast: string;
  navigateTabId?: string;
  statusBadge?: string;
  statusMeta?: string;
  nextPrimaryAction?: string;
  detailAppend?: string;
  composeTitle?: string;
  openDetailAfter?: boolean;
}

export interface PreviewActionPlan {
  messagingTabId?: string;
  feedTabId?: string;
  rules: PreviewActionRule[];
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
  /** Secondary skip link — defaults to "Skip". */
  skipLabel?: string;
  kind?: OnboardingSlideKind;
}

export interface ExpoTab {
  id: string;
  label: string;
  icon: ExpoIconName;
}

/** UI pattern for web preview — maps to shared renderers (see components/preview). */
export type PreviewPatternId =
  | "list-browse"
  | "content-detail"
  | "inbox-threads"
  | "cart-lines"
  | "shop-grid"
  | "collection-list"
  | "checkout-summary"
  | "feed-scroll"
  | "booking-browse"
  | "marketplace-browse"
  | "habit-checklist"
  | "notes-list"
  | "home-dashboard";

export interface ExpoThreadMessage {
  id: string;
  sender: "me" | "them";
  senderLabel: string;
  text: string;
  at: string;
}

export interface ExpoMessageThread {
  id: string;
  participant: string;
  participantAvatar?: string;
  preview: string;
  time: string;
  unread?: boolean;
  messages: ExpoThreadMessage[];
}

export interface ExpoCartLine {
  id: string;
  title: string;
  price: string;
  imageUrl: string;
  qty: number;
}

/** Stateful preview data (threads, cart) — synced with pattern renderers. */
export interface ExpoPreviewState {
  threads?: ExpoMessageThread[];
  cart?: ExpoCartLine[];
}

export interface ExpoPreviewPatterns {
  tabs: Record<string, PreviewPatternId>;
  /** Home tab pattern (hero + sections). */
  home?: PreviewPatternId;
  /** Detail overlay when opening a list item. */
  detail?: PreviewPatternId;
}

export interface ExpoTabScreen {
  title: string;
  subtitle: string;
  items: ExpoListItem[];
  patternId?: PreviewPatternId;
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
  /** Role selection + setup wizard (when marketplace / dual-sided). */
  flow?: ExpoAppFlow;
  /** Post-build summary for build room chat. */
  buildRecap?: ExpoBuildRecap;
  /** Kimi-reviewed button outcomes for this specific app. */
  previewActions?: PreviewActionPlan;
  tabs: ExpoTab[];
  onboarding: ExpoOnboardingSlide[];
  home: {
    headline: string;
    subheadline: string;
    heroLabel: string;
    heroSublabel: string;
    sections: ExpoHomeSection[];
  };
  /** Per-role home when flow.roles exists — keys match role.id */
  homeByRole?: Record<
    string,
    {
      headline: string;
      subheadline: string;
      heroLabel: string;
      heroSublabel: string;
      sections: ExpoHomeSection[];
    }
  >;
  tabScreens: Record<string, ExpoTabScreen>;
  profile: {
    displayName: string;
    tagline: string;
    stats: { label: string; value: string }[];
    settings: { label: string; icon: ExpoIconName }[];
  };
  theme: ExpoAppTheme;
  capabilities: ExpoAppCapabilities;
  /** Last capability self-review (behavior + UX + UI) after build or tweak. */
  capabilityAudit?: CapabilityAuditSnapshot;
  /** Tab → UI pattern assignments from capability pipeline. */
  previewPatterns?: ExpoPreviewPatterns;
  /** Live preview state (chat threads, cart lines). */
  previewState?: ExpoPreviewState;
}

export type ExpoAppModelInput = Omit<ExpoAppModel, "theme" | "version" | "capabilities">;

export type BuildExpoContext = { masterPrompt: MasterBuildPrompt };
