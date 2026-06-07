import { chatReply } from "@/lib/models";
import { imageForCategory } from "@/lib/expoApp/images";
import type { MasterBuildPrompt } from "@/lib/types";
import type { ExpoAppModel } from "./types";
import {
  canRemovePath,
  getStringAtPath,
  removeAtPath,
  setStringAtPath,
  supportsAccentTweak,
  supportsImageSwap,
} from "./tweakPaths";

export type SelectionTweakAction =
  | { type: "set"; value: string }
  | { type: "remove" }
  | { type: "rewrite_shorter" }
  | { type: "rewrite_friendly" }
  | { type: "rewrite_pro" }
  | { type: "accent_brighter" }
  | { type: "swap_image" };

const TONE: Record<string, string> = {
  rewrite_shorter: "Make it shorter — same meaning, fewer words.",
  rewrite_friendly: "Make it warmer and friendlier for everyday users.",
  rewrite_pro: "Make it more polished and professional.",
};

function cleanOneLine(text: string): string {
  const line = text.trim().split(/\n/)[0] ?? "";
  return line.replace(/^["']|["']$/g, "").slice(0, 120);
}

function bumpAccent(hex: string): string {
  const map: Record<string, string> = {
    "#FF7A63": "#E85D48",
    "#E85D48": "#D44A38",
    "#4A90D9": "#2E7BC4",
    "#6B8E6B": "#4F7A4F",
  };
  return map[hex.toUpperCase()] ?? "#E85D48";
}

export async function applySelectionTweak(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  path: string,
  action: SelectionTweakAction
): Promise<{ model: ExpoAppModel; reply: string }> {
  const current = getStringAtPath(model, path);

  if (action.type === "set") {
    const value = action.value.trim();
    if (!value) return { model, reply: "Enter some text first." };
    return {
      model: setStringAtPath(model, path, value),
      reply: `Updated → "${value.slice(0, 48)}${value.length > 48 ? "…" : ""}"`,
    };
  }

  if (action.type === "remove") {
    if (!canRemovePath(path)) return { model, reply: "Can't remove this — try changing the text." };
    return { model: removeAtPath(model, path), reply: "Removed from your app." };
  }

  if (action.type === "accent_brighter") {
    if (!supportsAccentTweak(path)) {
      return { model, reply: "Select the main button or hero to change accent." };
    }
    const accent = bumpAccent(model.theme.accent);
    return {
      model: { ...model, theme: { ...model.theme, accent } },
      reply: "Accent color updated in the preview.",
    };
  }

  if (action.type === "swap_image") {
    if (!supportsImageSwap(path)) {
      return { model, reply: "Select a card with a photo to swap it." };
    }
    const base = path.replace(/\.(title|subtitle|meta|primaryAction|quote|badge|imageUrl)$/, "");
    const imagePath = path.endsWith(".imageUrl") ? path : `${base}.imageUrl`;
    const cat = model.category ?? "general";
    const seed = Date.now() % 12;
    const url = imageForCategory(cat, seed);
    return {
      model: setStringAtPath(model, imagePath, url),
      reply: "Swapped in a fresh photo.",
    };
  }

  const tone = TONE[action.type];
  if (!tone || !current) {
    return { model, reply: "Nothing to rewrite here." };
  }

  const rewritten = await chatReply(
    `You edit ONE line of copy for the mobile app "${mp.appName}". ${tone} ` +
      `Return ONLY the new line — no quotes, no explanation.`,
    `Field: ${path}\nCurrent: ${current}`,
    80
  );

  const next = cleanOneLine(rewritten) || current;
  return {
    model: setStringAtPath(model, path, next),
    reply: `Now: "${next.slice(0, 56)}${next.length > 56 ? "…" : ""}"`,
  };
}
