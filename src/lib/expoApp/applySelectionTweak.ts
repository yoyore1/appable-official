import { flashChatComplete } from "@/lib/flashChat";
import { imageForCategory } from "@/lib/expoApp/images";
import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import { appendCoachContext, buildPreviewCoachContext } from "./previewCoachContext";
import type { ExpoAppModel } from "./types";
import {
  canRemovePath,
  getStringAtPath,
  removeAtPath,
  setStringAtPath,
  supportsAccentTweak,
  supportsColorTweak,
  supportsImageSwap,
} from "./tweakPaths";

export type SelectionTweakAction =
  | { type: "set"; value: string }
  | { type: "remove" }
  | { type: "rewrite_shorter" }
  | { type: "rewrite_friendly" }
  | { type: "rewrite_pro" }
  | { type: "rewrite_with"; instruction: string }
  | { type: "accent_brighter" }
  | { type: "swap_image" }
  | { type: "color_lighter" }
  | { type: "color_darker" }
  | { type: "color_warmer" }
  | { type: "color_cooler" };

const TONE: Record<string, string> = {
  rewrite_shorter: "Make it shorter — same meaning, fewer words.",
  rewrite_friendly: "Make it warmer and friendlier for everyday users.",
  rewrite_pro: "Make it more polished and professional.",
};

function cleanOneLine(text: string): string {
  const line = text.trim().split(/\n/)[0] ?? "";
  return line.replace(/^["']|["']$/g, "").slice(0, 120);
}

/** Last resort when the model returns empty (missing key, timeout, etc.). */
function chipRewriteFallback(
  current: string,
  task: string,
  path: string,
  appName: string
): string {
  const t = task.toLowerCase();
  const c = current.toLowerCase();
  const isRoleDesc = path.includes("roles") && path.endsWith(".description");

  if (isRoleDesc && /irresistible|tempting|appealing/.test(t)) {
    if (/walk my|dog owner|owner|need someone/.test(c)) {
      return "Post a walk and get matched fast.";
    }
    if (/walk dogs|walker|earn/.test(c)) {
      return "Pick walks nearby and earn on your schedule.";
    }
    return `See why ${appName} fits you — tap to get started.`;
  }
  if (/crystal clear|who should pick|who it's for/.test(t) && isRoleDesc) {
    if (/walk my|owner|need someone/.test(c)) {
      return "For dog owners who need a reliable walker.";
    }
    if (/walk dogs|walker|earn/.test(c)) {
      return "For people who want to walk dogs and earn.";
    }
  }
  if (/shorter|fewer words/.test(t) && current.trim()) {
    const words = current.trim().split(/\s+/);
    if (words.length > 4) {
      return words.slice(0, Math.min(6, Math.ceil(words.length * 0.7))).join(" ");
    }
  }
  return "";
}

function fieldHint(path: string): string {
  if (/\.description$/.test(path) && path.includes("roles")) {
    return "role picker description (gray subtext under the role name)";
  }
  if (/\.label$/.test(path) && path.includes("roles")) {
    return "role picker title (bold role name)";
  }
  if (/setupfields.*\.label$/.test(path)) return "form field label";
  if (/setupfields.*\.placeholder$/.test(path)) return "form field placeholder";
  if (/setupfields.*\.section$/.test(path)) return "form section header";
  if (/setupfields.*\.options/.test(path)) return "form option label";
  if (/herolabel|primaryaction|ctalabel|setupsubmitlabel/i.test(path)) return "button label";
  if (/headline|setuptitle|welcometitle/i.test(path)) return "headline";
  if (/subtitle|subheadline|sublabel|setupsubtitle/i.test(path)) return "subtext";
  return "copy line";
}

async function rewriteLineCopy(
  mp: MasterBuildPrompt,
  coach: ReturnType<typeof buildPreviewCoachContext>,
  path: string,
  current: string,
  task: string
): Promise<string> {
  const hint = fieldHint(path);
  const system = appendCoachContext(
    `You rewrite ONE ${hint} for the mobile app "${mp.appName}". ` +
      `Output ONLY the new line — no quotes, labels, or explanation. Max 120 characters.`,
    coach
  );
  const user =
    `Current ${hint}:\n"${current}"\n\n` +
    `Rewrite task: ${task}\n\n` +
    `Write a different line that satisfies the task. Do not repeat the current line verbatim.`;

  // flashChatComplete — same Qwen path as brainstorm (disables thinking, strips empty replies).
  const { text } = await flashChatComplete(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.72, maxTokens: 160, timeoutMs: 35_000 }
  );

  let next = cleanOneLine(text);
  if (!next.trim()) {
    const retry = await flashChatComplete(
      [
        { role: "system", content: system },
        {
          role: "user",
          content: `${user}\n\nReply with ONLY the rewritten line, nothing else.`,
        },
      ],
      { temperature: 0.65, maxTokens: 200, timeoutMs: 40_000 }
    );
    next = cleanOneLine(retry.text);
  }
  if (!next.trim()) {
    next = chipRewriteFallback(current, task, path, mp.appName);
  }
  return next;
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

function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9A-Fa-f]{6})$/);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

function shiftColor(hex: string, mode: "lighter" | "darker" | "warmer" | "cooler"): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  let [r, g, b] = rgb;
  if (mode === "lighter") {
    r += (255 - r) * 0.12;
    g += (255 - g) * 0.12;
    b += (255 - b) * 0.12;
  } else if (mode === "darker") {
    r *= 0.88;
    g *= 0.88;
    b *= 0.88;
  } else if (mode === "warmer") {
    r += 14;
    g += 4;
    b -= 8;
  } else {
    r -= 8;
    g += 2;
    b += 14;
  }
  return toHex(r, g, b);
}

export async function applySelectionTweak(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  path: string,
  action: SelectionTweakAction,
  interview: InterviewTurn[] = []
): Promise<{ model: ExpoAppModel; reply: string }> {
  const coach = buildPreviewCoachContext(mp, interview, model);
  const current = getStringAtPath(model, path);

  if (action.type === "set") {
    const value = action.value.trim();
    if (!value) {
      return { model, reply: supportsColorTweak(path) ? "Pick a color first." : "Enter some text first." };
    }
    if (supportsColorTweak(path)) {
      const normalized = value.startsWith("#") ? value : `#${value}`;
      if (!parseHex(normalized)) return { model, reply: "That color didn't work — try again." };
      return {
        model: setStringAtPath(model, path, normalized.toUpperCase()),
        reply: "Color updated in the preview.",
      };
    }
    if (path.endsWith(".emoji")) {
      return {
        model: setStringAtPath(model, path, value),
        reply: "Icon updated in the preview.",
      };
    }
    if (path.endsWith(".imageUrl")) {
      return {
        model: setStringAtPath(model, path, value),
        reply: "Image updated in the preview.",
      };
    }
    const next = setStringAtPath(model, path, value);
    if (getStringAtPath(next, path).trim() === current.trim()) {
      if (value.trim() === current.trim()) {
        return { model, reply: "Already says that — no change needed." };
      }
      return { model, reply: "Couldn't update that field — try tapping the text in the preview again." };
    }
    return {
      model: next,
      reply: `Updated → "${value.slice(0, 48)}${value.length > 48 ? "…" : ""}"`,
    };
  }

  if (
    action.type === "color_lighter" ||
    action.type === "color_darker" ||
    action.type === "color_warmer" ||
    action.type === "color_cooler"
  ) {
    if (!supportsColorTweak(path)) {
      return { model, reply: "Tap a background or color block to change colors." };
    }
    const mode = action.type.replace("color_", "") as "lighter" | "darker" | "warmer" | "cooler";
    const next = shiftColor(current || model.theme.accent, mode);
    return {
      model: setStringAtPath(model, path, next),
      reply: "Color updated in the preview.",
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

  const task =
    action.type === "rewrite_with"
      ? action.instruction.trim()
      : TONE[action.type as keyof typeof TONE];

  if (!task || !current.trim()) {
    return {
      model,
      reply:
        action.type === "rewrite_with" && !action.instruction.trim()
          ? "Type what you want first."
          : "Nothing to rewrite here — tap the text in the preview first.",
    };
  }

  const next = await rewriteLineCopy(mp, coach, path, current.trim(), task);
  if (!next.trim()) {
    return {
      model,
      reply: "Rewrite didn't come through — try again or use the custom box below.",
    };
  }
  if (next.trim().toLowerCase() === current.trim().toLowerCase()) {
    const hint =
      action.type === "rewrite_shorter"
        ? "Already pretty short — try custom wording below."
        : action.type === "rewrite_friendly"
          ? "Already friendly enough."
          : action.type === "rewrite_pro"
            ? "Already polished enough."
            : "Got the same line back — try the custom box with specifics.";
    return { model, reply: hint };
  }
  const updated = setStringAtPath(model, path, next);
  if (getStringAtPath(updated, path).trim() !== next.trim()) {
    return { model, reply: "Couldn't update that field — try tapping the text in the preview again." };
  }
  return {
    model: updated,
    reply: `Now: "${next.slice(0, 56)}${next.length > 56 ? "…" : ""}"`,
  };
}
