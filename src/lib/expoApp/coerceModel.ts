import type { ExpoAppModel } from "./types";

const EMPTY_HOME: ExpoAppModel["home"] = {
  headline: "",
  subheadline: "",
  heroLabel: "",
  heroSublabel: "",
  sections: [],
};

const DEFAULT_THEME: ExpoAppModel["theme"] = {
  accent: "#FF7A63",
  cream: "#FDFAF4",
  card: "#fff",
  charcoal: "#2B2624",
  muted: "#5C534F",
  line: "#E8E0D8",
  radius: 16,
  vibe: "Soft",
  fontDisplay: "Fraunces",
  fontBody: "DM Sans",
};

/** Fill missing arrays/objects so preview + audit never crash on partial JSON. */
export function coerceExpoAppModel(raw: unknown): ExpoAppModel {
  const m = (raw && typeof raw === "object" ? raw : {}) as Partial<ExpoAppModel>;
  const home = m.home ?? EMPTY_HOME;

  return {
    version: m.version ?? 1,
    category: m.category ?? "general",
    flow: m.flow,
    buildRecap: m.buildRecap,
    previewActions: m.previewActions,
    tabs: Array.isArray(m.tabs) ? m.tabs : [],
    onboarding: Array.isArray(m.onboarding) ? m.onboarding : [],
    home: {
      headline: home.headline ?? "",
      subheadline: home.subheadline ?? "",
      heroLabel: home.heroLabel ?? "",
      heroSublabel: home.heroSublabel ?? "",
      sections: Array.isArray(home.sections) ? home.sections : [],
    },
    homeByRole: m.homeByRole,
    tabScreens:
      m.tabScreens && typeof m.tabScreens === "object" && !Array.isArray(m.tabScreens)
        ? m.tabScreens
        : {},
    profile: {
      displayName: m.profile?.displayName ?? "",
      tagline: m.profile?.tagline ?? "",
      stats: Array.isArray(m.profile?.stats) ? m.profile.stats : [],
      settings: Array.isArray(m.profile?.settings) ? m.profile.settings : [],
    },
    theme: { ...DEFAULT_THEME, ...m.theme },
    elementStyles:
      m.elementStyles && typeof m.elementStyles === "object"
        ? m.elementStyles
        : undefined,
    capabilities: {
      enabled: Array.isArray(m.capabilities?.enabled) ? m.capabilities.enabled : [],
      uiFeatures: Array.isArray(m.capabilities?.uiFeatures) ? m.capabilities.uiFeatures : undefined,
      heroAction: m.capabilities?.heroAction ?? "",
      heroSublabel: m.capabilities?.heroSublabel ?? "",
      visionPrompt: m.capabilities?.visionPrompt ?? "",
    },
    capabilityAudit: m.capabilityAudit,
    previewPatterns: m.previewPatterns,
    previewState: m.previewState,
  };
}
