import type { ExpoListItem } from "./types";
import {
  buildPreviewInteractionConfig,
  type PreviewInteractionConfig,
  type SettingBinding,
  type SettingsKind,
} from "./smartInteractions";

export type { PreviewInteractionConfig, SettingBinding, SettingsKind };
export {
  buildPreviewInteractionConfig,
  extractCollectionLines,
  isListsTab,
  primaryContentTab,
  resolveTabScreen,
  statUsesSavedCount,
} from "./smartInteractions";

/** @deprecated Use buildPreviewInteractionConfig(model).settings[label] */
export function settingsKind(label: string): SettingsKind {
  const ix = buildPreviewInteractionConfig({
    version: 1,
    category: "general",
    tabs: [],
    onboarding: [],
    home: {
      headline: "",
      subheadline: "",
      heroLabel: "",
      heroSublabel: "",
      sections: [],
    },
    tabScreens: {},
    profile: { displayName: "", tagline: "", stats: [], settings: [{ label, icon: "settings" }] },
    theme: {
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
    },
    capabilities: { enabled: [], heroAction: "", heroSublabel: "", visionPrompt: "" },
  });
  return ix.settings[label]?.kind ?? "info";
}

export function legalDocForSetting(label: string): "privacy" | "terms" | "support" | null {
  const l = label.toLowerCase();
  if (/privacy|legal|shield|data/.test(l)) return "privacy";
  if (/terms|service/.test(l)) return "terms";
  if (/help|support|faq/.test(l)) return "support";
  return null;
}

export function settingsDescription(label: string, appName: string): string {
  return `${label} for ${appName}. Saved for this preview session.`;
}

export function sharePayload(
  item: ExpoListItem,
  appName: string,
  ix?: PreviewInteractionConfig
): { title: string; text: string } {
  const lines = [
    `${item.title}`,
    item.subtitle,
    item.body,
    item.ingredients?.length ? `Ingredients: ${item.ingredients.join(", ")}` : "",
    item.steps?.length ? item.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : "",
  ].filter(Boolean);
  return {
    title: ix?.share.itemTitle(item) ?? `${item.title} — ${appName}`,
    text: lines.join("\n\n"),
  };
}

export async function shareContent(
  payload: { title: string; text: string }
): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: payload.title, text: payload.text });
      return "shared";
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload.text);
      return "copied";
    }
  } catch {
    /* user cancelled share sheet */
  }
  return "failed";
}
