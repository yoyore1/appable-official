import type { MasterBuildPrompt } from "@/lib/types";

/** Accent hex (no #) — mirrors Builder rngen palette. */
export function accentHex(colors: string): string {
  const c = colors.toLowerCase();
  if (c.includes("green") || c.includes("sage")) return "56A274";
  if (c.includes("blue")) return "4C8DFF";
  if (c.includes("purple") || c.includes("violet")) return "8A6DFF";
  if (c.includes("pink") || c.includes("rose")) return "FF6FAE";
  if (c.includes("gold") || c.includes("lux")) return "C8A24A";
  return "FF7A63";
}

export function expoTheme(mp: MasterBuildPrompt) {
  const accent = accentHex(mp.colors);
  return {
    accent: `#${accent}`,
    cream: "#FDFAF4",
    card: "#FFFFFF",
    charcoal: "#2B2624",
    muted: "#8A817B",
    line: "#EFE7DA",
    radius: 20,
  };
}

/** Checklist lines for the confirm step in chat. */
export function planChecklist(mp: MasterBuildPrompt): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: "App name", value: mp.appName },
    { label: "Idea", value: mp.description },
    { label: "For", value: mp.audience },
  ];
  if (mp.twist) rows.push({ label: "Your twist", value: mp.twist });
  rows.push(
    { label: "Features", value: mp.features.join(" · ") },
    { label: "Colors", value: mp.colors },
    { label: "Style", value: mp.vibe }
  );
  return rows;
}
