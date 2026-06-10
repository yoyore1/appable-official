import type { TweakTarget } from "./tweakPaths";
import { getStringAtPath } from "./tweakPaths";
import type { ExpoAppModel } from "./types";

/** What the founder is looking at in the phone preview when they hit Build. */
export type PreviewBuildState = {
  launchPhase: "auth" | "role" | "setup" | "onboarding" | "main";
  onboardingIndex?: number;
  selectedRoleId?: string;
  selectedRoleLabel?: string;
  /** Tap-to-fix selection in the preview. */
  focusedPath?: string;
};

export function formatPreviewBuildStateBlock(
  state: PreviewBuildState | undefined,
  model: ExpoAppModel
): string {
  if (!state) return "";

  const lines: string[] = [
    "--- User's current preview screen (PRIORITY — edit THIS screen unless they name another) ---",
  ];

  switch (state.launchPhase) {
    case "setup": {
      const title = model.flow?.setupTitle ?? "Tell us about you";
      const btn = model.flow?.setupSubmitLabel ?? "Get Started →";
      lines.push(`Screen: PROFILE SETUP (NOT onboarding carousel)`);
      lines.push(`Title: "${title}"`);
      lines.push(`Primary button path: flow.setupSubmitLabel → "${btn}"`);
      lines.push(
        `Field paths: flow.setupFields[i].label / .placeholder (${model.flow?.setupFields?.length ?? 0} fields)`
      );
      if (state.selectedRoleLabel) {
        lines.push(`Selected role: ${state.selectedRoleLabel}`);
      }
      break;
    }
    case "role":
      lines.push(`Screen: ROLE PICKER`);
      lines.push(
        `Roles: ${(model.flow?.roles ?? []).map((r, i) => `${r.label} (flow.roles[${i}])`).join(", ") || "none"}`
      );
      break;
    case "onboarding": {
      const idx = state.onboardingIndex ?? 0;
      const slide = model.onboarding[idx];
      lines.push(`Screen: ONBOARDING SLIDE ${idx + 1} of ${model.onboarding.length}`);
      if (slide) {
        lines.push(`Title: "${slide.title}"`);
        lines.push(`Button path: onboarding[${idx}].ctaLabel → "${slide.ctaLabel}"`);
      }
      break;
    }
    case "auth":
      lines.push(`Screen: SIGN-IN / SIGN-UP`);
      break;
    case "main":
      lines.push(`Screen: MAIN APP (tab: home)`);
      lines.push(`Home headline: "${model.home.headline}"`);
      break;
  }

  if (state.focusedPath) {
    const val = getStringAtPath(model, state.focusedPath);
    lines.push(`Tapped/focused element: ${state.focusedPath} → "${val}"`);
  }

  lines.push(
    "If they say 'this screen' / attach a screenshot / 'add back button', apply changes on the screen above — not a different step in the flow."
  );

  return lines.join("\n");
}

/** Map preview phase to copy-field screen ids used in previewCopyFields. */
export function screenIdsForBuildState(state: PreviewBuildState | undefined): string[] {
  if (!state) return [];
  switch (state.launchPhase) {
    case "setup":
      return ["setup"];
    case "role":
      return ["role"];
    case "onboarding":
      return ["onboarding", "onboarding-0"];
    case "auth":
      return ["sign-in", "sign-up"];
    case "main":
      return ["home"];
    default:
      return [];
  }
}

export function previewStateFromTarget(
  target: TweakTarget | null | undefined,
  fallback: PreviewBuildState
): PreviewBuildState {
  if (!target?.path) return fallback;
  return { ...fallback, focusedPath: target.path };
}
