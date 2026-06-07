import type { MasterBuildPrompt } from "@/lib/types";

/** Free on-device premium libraries (codegen — use with restraint). */
export const PREMIUM_VISUAL_LIBS = [
  "expo-linear-gradient — subtle gradients on backgrounds, buttons, cards",
  "expo-blur — frosted-glass overlays, tab bars, sheet backgrounds",
  "@react-native-masked-view/masked-view — gradient text, masks",
  "react-native-svg — crisp shapes, decorative elements",
  "react-native-skia — hero graphics only (optional)",
] as const;

export const PREMIUM_MOTION_LIBS = [
  "lottie-react-native — illustrations, loading, success, empty states",
  "react-native-reanimated — spring press, screen transitions",
  "moti — staggered fade-up on screen load",
  "react-native-gesture-handler — swipe dismiss, pull-to-refresh",
  "expo-haptics — haptic on EVERY tap, tab, toggle, save (#1 alive lever)",
] as const;

export const PREMIUM_DETAIL_LIBS = [
  "react-native-shimmer-placeholder — skeleton loaders, never blank spinners",
  "@gorhom/bottom-sheet — native bottom sheets for detail/filters",
  "@shopify/flash-list — performant lists (not default FlatList)",
  "lucide-react-native — consistent icon set",
] as const;

export const TOP_PREMIUM_LEVERS = [
  "1. Lottie animated illustrations (not static onboarding images)",
  "2. expo-blur frosted glass on sheets and tab bar",
  "3. Shimmer/skeleton loaders — never blank screens",
] as const;

export function premiumPolishForPrompt(mp: MasterBuildPrompt): {
  visual: string[];
  motion: string[];
  details: string[];
  topLevers: string[];
  principle: string;
} {
  return {
    visual: [...PREMIUM_VISUAL_LIBS],
    motion: [...PREMIUM_MOTION_LIBS],
    details: [...PREMIUM_DETAIL_LIBS],
    topLevers: [...TOP_PREMIUM_LEVERS],
    principle:
      `Disciplined execution for ${mp.appName}: one hero per screen, coral design system, haptics everywhere, real imagery — not effect overload.`,
  };
}

/** Packages to list in device/codegen plan. */
export function premiumPolishPackages(): string[] {
  return [
    "expo-linear-gradient",
    "expo-blur",
    "lottie-react-native",
    "react-native-reanimated",
    "moti",
    "react-native-gesture-handler",
    "expo-haptics",
    "react-native-shimmer-placeholder",
    "@gorhom/bottom-sheet",
    "@shopify/flash-list",
    "lucide-react-native",
    "react-native-svg",
  ];
}
