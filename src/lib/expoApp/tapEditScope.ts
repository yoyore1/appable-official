import { getScopedCopyFields, type PreviewCopyField } from "./previewCopyFields";
import type { ExpoAppModel } from "./types";

const PREVIEW_PATH_TAG_RE = /\[preview path:\s*([^\]]+)\]/i;

/** Machine-readable field scope from tap-to-edit messages. */
export function extractPreviewPathFromMessage(message: string): string | null {
  const m = message.match(PREVIEW_PATH_TAG_RE);
  return m?.[1]?.trim() ?? null;
}

export function isTapPathScopedMessage(message: string): boolean {
  return Boolean(extractPreviewPathFromMessage(message));
}

export type TapEditScope = {
  path: string;
  target: PreviewCopyField;
  siblings: PreviewCopyField[];
};

export function resolveTapEditScope(
  model: ExpoAppModel,
  appName: string,
  message: string
): TapEditScope | null {
  const path = extractPreviewPathFromMessage(message);
  if (!path) return null;
  const scoped = getScopedCopyFields(model, appName, path);
  if (!scoped) return null;
  return { path, ...scoped };
}

/** Human block for brainstorm — only the tapped field (+ same-screen siblings). */
export function formatTapScopedCopyBlock(scope: TapEditScope): string {
  const lines = [
    `TAPPED FIELD (coach ONLY this path — do not rewrite other UI):`,
    `• Path: ${scope.path}`,
    `• Label: ${scope.target.label}`,
    `• Screen: ${scope.target.screen}`,
    `• Current: "${scope.target.value}"`,
  ];
  if (scope.siblings.length) {
    lines.push(
      "Same screen (context only — do not propose changes unless user tapped these):"
    );
    for (const s of scope.siblings) {
      lines.push(`• ${s.label} (${s.path}): "${s.value}"`);
    }
  }
  return lines.join("\n");
}

/** True when path is a single role card field (label or description). */
export function isPerRoleCopyPath(path: string): boolean {
  return /^flow\.roles\[\d+\]\.(label|description)$/.test(path);
}

/** Shared welcome line above role buttons — one string for all users. */
export function isSharedWelcomeCopyPath(path: string): boolean {
  return path === "flow.welcomeTitle" || path === "flow.welcomeSubtitle";
}
