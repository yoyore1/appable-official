import { profileFromMasterPrompt } from "@/lib/designResearch";
import type { MasterBuildPrompt, Vibe } from "@/lib/types";
import type { ExpoAppTheme } from "./types";

export function accentHex(colors: string): string {
  const c = colors.toLowerCase();
  if (c.includes("green") || c.includes("sage")) return "#56A274";
  if (c.includes("blue")) return "#4C8DFF";
  if (c.includes("purple") || c.includes("violet")) return "#8A6DFF";
  if (c.includes("pink") || c.includes("rose")) return "#FF6FAE";
  if (c.includes("gold") || c.includes("lux")) return "#C8A24A";
  return "#FF7A63";
}

export function buildTheme(mp: MasterBuildPrompt): ExpoAppTheme {
  const profile = profileFromMasterPrompt(mp);
  return {
    accent: accentHex(mp.colors),
    cream: "#FDFAF4",
    card: "#FFFFFF",
    charcoal: "#2B2624",
    muted: "#8A817B",
    line: "#EFE7DA",
    radius: 20,
    vibe: mp.vibe,
    fontDisplay: profile.fontDisplay,
    fontBody: profile.fontBody,
  };
}
