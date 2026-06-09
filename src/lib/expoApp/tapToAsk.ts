import {
  appendCoachContext,
  type PreviewCoachContext,
} from "./previewCoachContext";
import { getStringAtPath, isMediaTarget, supportsColorTweak } from "./tweakPaths";
import type { TweakTarget } from "./tweakPaths";
import type { ExpoAppModel } from "./types";

export type TapToAskSuggestion = {
  id: string;
  label: string;
  prompt: string;
};

function tabLabelForPath(model: ExpoAppModel, path: string): string | null {
  const match = path.match(/tabScreens\.([^.[\]]+)/i);
  if (!match) return null;
  const tabId = match[1]!;
  return model.tabs.find((t) => t.id === tabId)?.label ?? tabId;
}

function describeColorTarget(target: TweakTarget): string {
  const key = target.path.replace(/^theme\./, "");
  if (key === "cream") return "the app background color";
  if (key === "accent") return "the main brand / button color";
  if (key === "card") return "the card background color";
  return `the ${target.label.toLowerCase()}`;
}

/** Plain English — what the user tapped in the preview. */
export function describeTweakTarget(model: ExpoAppModel, target: TweakTarget): string {
  if (supportsColorTweak(target.path)) {
    const tab = tabLabelForPath(model, target.path);
    let where = "across your app";
    if (tab) where = `on ${tab}`;
    else if (target.path.includes("onboarding") || model.onboarding.length) {
      where = "on onboarding";
    }
    return `${describeColorTarget(target)} ${where}`;
  }

  const path = target.path.toLowerCase();
  const field = target.field.toLowerCase();
  const tab = tabLabelForPath(model, path);

  let where = "in your app";
  if (path.startsWith("home.")) where = "on Home";
  else if (tab) where = `on ${tab}`;
  else if (path.includes("onboarding")) where = "on onboarding";
  else if (path.includes("roles")) where = "on the role picker";
  else if (path.includes("flow.") || path.includes("auth")) where = "on sign-in";
  else if (path.includes("profile")) where = "on Profile";

  let kind = target.label;
  if (/primaryaction|herolabel|heroaction|cta|button|action/.test(`${field} ${path}`)) {
    kind = `the "${target.label}" button`;
  } else if (/headline/.test(field)) {
    kind = `the headline "${target.label}"`;
  } else if (/subheadline|subtitle|sublabel/.test(field)) {
    kind = `the subtext "${target.label}"`;
  } else if (/title/.test(field) && !/headline/.test(field)) {
    kind = `the title "${target.label}"`;
  } else if (/imageurl|photo|image/.test(field)) {
    kind = `the image for "${target.label}"`;
  }

  return `${kind} ${where}`;
}

function withContext(
  model: ExpoAppModel,
  target: TweakTarget,
  question: string,
  coach?: PreviewCoachContext | null
): string {
  const value = getStringAtPath(model, target.path).trim();
  const place = describeTweakTarget(model, target);
  const quote = value ? ` It currently says "${value}".` : "";
  return appendCoachContext(
    `${question} I'm looking at ${place}.${quote}`,
    coach
  );
}

function withColorContext(
  model: ExpoAppModel,
  target: TweakTarget,
  question: string,
  coach?: PreviewCoachContext | null
): string {
  const value = getStringAtPath(model, target.path).trim();
  const place = describeTweakTarget(model, target);
  const quote = value ? ` The color is ${value} right now.` : "";
  return appendCoachContext(
    `${question} I'm looking at ${place}.${quote}`,
    coach
  );
}

export function buildTapToAskDraftPrompt(
  model: ExpoAppModel,
  target: TweakTarget,
  draft: string,
  coach?: PreviewCoachContext | null
): string {
  const current = getStringAtPath(model, target.path).trim();
  const place = describeTweakTarget(model, target);
  const next = draft.trim();
  if (!next) {
    return appendCoachContext(`What do you think of ${place}?`, coach);
  }
  if (next === current) {
    return appendCoachContext(
      `What do you think of this? It says "${current}" — ${place}.`,
      coach
    );
  }
  return appendCoachContext(
    `What do you think of "${next}" instead of "${current}" for ${place}? Give me one better option if you'd change it.`,
    coach
  );
}

/** Short chips — same vibe as Build quick tweaks, but answers go to chat only. */
export function getTapToAskSuggestions(
  model: ExpoAppModel,
  target: TweakTarget,
  coach?: PreviewCoachContext | null
): TapToAskSuggestion[] {
  const ask = (question: string) => withContext(model, target, question, coach);
  const askColor = (question: string) => withColorContext(model, target, question, coach);

  if (isMediaTarget(target)) {
    const kind = target.field === "icon" ? "icon" : "image";
    return [
      { id: "media-fit", label: "Does this fit?", prompt: ask(`Does this ${kind} fit the app?`) },
      { id: "media-better", label: "Better idea?", prompt: ask(`What ${kind} would work better here?`) },
    ];
  }

  if (supportsColorTweak(target.path)) {
    return [
      { id: "color-ok", label: "Looks ok?", prompt: askColor("Does this color work?") },
      { id: "color-loud", label: "Too loud?", prompt: askColor("Is this too loud or too dull?") },
      { id: "color-trust", label: "Trustworthy?", prompt: askColor("Does this feel trustworthy?") },
    ];
  }

  return [
    { id: "shorter", label: "Shorter", prompt: ask("Give me a shorter version.") },
    { id: "friendlier", label: "Friendlier", prompt: ask("Give me a friendlier version.") },
    { id: "clearer", label: "Clearer", prompt: ask("Say this more clearly.") },
    { id: "good", label: "Good enough?", prompt: ask("Is this good enough or what would you change?") },
  ];
}

