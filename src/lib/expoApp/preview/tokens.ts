import type { ExpoAppTheme } from "../types";

export interface PreviewTokens extends ExpoAppTheme {
  accentSoft: string;
  accentMuted: string;
  success: string;
  danger: string;
  radiusSm: number;
  radiusMd: number;
  radiusLg: number;
  radiusXl: number;
  padScreen: number;
  padCard: number;
  shadowCard: string;
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Design tokens for preview components — always derived from the app theme. */
export function previewTokens(theme: ExpoAppTheme): PreviewTokens {
  return {
    ...theme,
    accentSoft: hexAlpha(theme.accent, 0.14),
    accentMuted: hexAlpha(theme.accent, 0.08),
    success: "#56A274",
    danger: "#D64545",
    radiusSm: 10,
    radiusMd: 14,
    radiusLg: theme.radius,
    radiusXl: 24,
    padScreen: 20,
    padCard: 16,
    shadowCard: "0 8px 24px rgba(43,38,36,0.08)",
  };
}
