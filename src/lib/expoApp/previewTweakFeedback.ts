import type { SelectionTweakAction } from "./applySelectionTweak";
import { supportsColorTweak } from "./tweakPaths";

/** Shown while the server applies a tweak and the preview re-renders. */
export function tweakProgressLabel(
  action: SelectionTweakAction,
  path: string
): string {
  if (
    supportsColorTweak(path) ||
    action.type === "accent_brighter" ||
    action.type.startsWith("color_")
  ) {
    return "Color updating…";
  }
  if (action.type === "swap_image" || path.endsWith(".imageUrl")) {
    return "Image updating…";
  }
  if (action.type === "rewrite_with" || action.type.startsWith("rewrite_")) {
    return "Text updating…";
  }
  if (action.type === "set" && path.endsWith(".emoji")) {
    return "Icon updating…";
  }
  if (action.type === "set") {
    return "Text updating…";
  }
  if (action.type === "remove") {
    return "Removing…";
  }
  return "Updating preview…";
}

/** Wait for React commit + browser paint after model state changes. */
export function waitForPreviewPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
