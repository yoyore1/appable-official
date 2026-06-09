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
  /** Build-mode rewrite instruction (contextual chips). */
  rewriteInstruction?: string;
};

type TweakElementKind =
  | "cta"
  | "headline"
  | "subtext"
  | "title"
  | "list_item"
  | "tab_label"
  | "role_label"
  | "role_description"
  | "quote"
  | "tagline"
  | "settings_row"
  | "generic";

type TweakScreenKind =
  | "home"
  | "onboarding"
  | "role_picker"
  | "auth"
  | "profile"
  | "tab"
  | "generic";

type TabVibe = "messaging" | "commerce" | "social" | "browse" | "generic";

type ChipDef = { id: string; label: string; ask: string; rewrite: string };

function tabLabelForPath(model: ExpoAppModel, path: string): string | null {
  const match = path.match(/tabScreens\.([^.[\]]+)/i);
  if (!match) return null;
  const tabId = match[1]!;
  return model.tabs.find((t) => t.id === tabId)?.label ?? tabId;
}

function tabIdFromPath(path: string): string | null {
  const m = path.match(/tabScreens\.([^.[\]]+)/i);
  return m?.[1] ?? null;
}

function tabVibe(model: ExpoAppModel, tabId: string): TabVibe {
  const tab = model.tabs.find((t) => t.id === tabId);
  const label = tab?.label ?? tabId;
  const pattern =
    model.previewPatterns?.tabs[tabId] ?? model.tabScreens[tabId]?.patternId ?? "";
  const blob = `${label} ${tabId} ${pattern}`.toLowerCase();
  if (/message|chat|inbox|conversation/.test(blob)) return "messaging";
  if (/cart|shop|checkout|buy|commerce|order/.test(blob)) return "commerce";
  if (/feed|social|discover|community/.test(blob)) return "social";
  if (/browse|list|explore|walk|map/.test(blob)) return "browse";
  return "generic";
}

function classifyTweakTarget(
  model: ExpoAppModel,
  target: TweakTarget
): { screen: TweakScreenKind; element: TweakElementKind; tabId: string | null } {
  const path = target.path.toLowerCase();
  const field = target.field.toLowerCase();
  const blob = `${path} ${field}`;

  let screen: TweakScreenKind = "generic";
  if (path.startsWith("home.")) screen = "home";
  else if (path.includes("onboarding")) screen = "onboarding";
  else if (path.includes("flow.roles")) screen = "role_picker";
  else if (path.includes("setupfields")) screen = "onboarding";
  else if (path.includes("flow.") || path.includes("auth")) screen = "auth";
  else if (path.startsWith("profile.")) screen = "profile";
  else if (path.startsWith("tabscreens.") || path.startsWith("tabs[")) screen = "tab";

  let element: TweakElementKind = "generic";
  if (/primaryaction|herolabel|ctalabel|hero button/.test(blob) || field === "button") {
    element = "cta";
  } else if (/headline|welcometitle|setuptitle/.test(blob) && !/sub/.test(blob)) {
    element = "headline";
  } else if (field === "role label") {
    element = "role_label";
  } else if (path.includes("roles") && field === "description") {
    element = "role_description";
  } else if (/placeholder/.test(blob)) {
    element = "subtext";
  } else if (/section header|field label|option/.test(blob)) {
    element = "title";
  } else if (/subheadline|subtitle|sublabel|description/.test(blob)) {
    element = "subtext";
  } else if (field === "tagline") {
    element = "tagline";
  } else if (/items\[\d+\]\.title/.test(path)) {
    element = "list_item";
  } else if (/tabs\[\d+\]\.label/.test(path)) {
    element = "tab_label";
  } else if (/quote/.test(blob)) {
    element = "quote";
  } else if (/settings\[\d+\]/.test(path)) {
    element = "settings_row";
  } else if (/title|section title|card title|tab title|list item/.test(blob)) {
    element = "title";
  }

  return { screen, element, tabId: tabIdFromPath(path) };
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
  else if (path.includes("welcome") || path.includes("roles")) where = "on the role picker";
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
    `${question} I'm looking at ${place}.${quote} [preview path: ${target.path}]`,
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

function chip(
  model: ExpoAppModel,
  target: TweakTarget,
  def: ChipDef,
  coach?: PreviewCoachContext | null
): TapToAskSuggestion {
  return {
    id: def.id,
    label: def.label,
    prompt: withContext(model, target, def.ask, coach),
    rewriteInstruction: def.rewrite,
  };
}

function contextualChipDefs(
  model: ExpoAppModel,
  target: TweakTarget
): ChipDef[] {
  const { screen, element, tabId } = classifyTweakTarget(model, target);
  const vibe = tabId ? tabVibe(model, tabId) : "generic";

  const shorter: ChipDef = {
    id: "shorter",
    label: "Shorter",
    ask: "Give me a shorter version.",
    rewrite: "Make it shorter — same meaning, fewer words.",
  };
  const friendlier: ChipDef = {
    id: "friendlier",
    label: "Friendlier",
    ask: "Give me a friendlier version.",
    rewrite: "Make it warmer and friendlier for everyday users.",
  };
  const clearer: ChipDef = {
    id: "clearer",
    label: "Clearer",
    ask: "Say this more clearly.",
    rewrite: "Make the meaning clearer — plain language, no jargon.",
  };

  if (element === "cta") {
    if (screen === "onboarding") {
      return [
        {
          id: "signup",
          label: "Boost sign-up",
          ask: "How do I get more people to tap through here?",
          rewrite:
            "Drive sign-up — clear benefit, action-oriented, welcoming not pushy.",
        },
        {
          id: "less-pushy",
          label: "Less pushy",
          ask: "This feels too salesy — soften it.",
          rewrite: "Tone down pressure — keep it warm and low-friction.",
        },
        shorter,
      ];
    }
    if (screen === "home") {
      return [
        {
          id: "action",
          label: "Drive action",
          ask: "What would make someone tap this button?",
          rewrite:
            "Action-driving — clear next step, compelling, not sleazy.",
        },
        {
          id: "value",
          label: "Clearer value",
          ask: "What's the clearest value prop for this button?",
          rewrite: "Lead with the clearest user benefit in as few words as possible.",
        },
        shorter,
      ];
    }
    if (vibe === "commerce") {
      return [
        {
          id: "buy",
          label: "Drive purchase",
          ask: "How do I make people more likely to buy?",
          rewrite: "Conversion-focused — clear value, gentle urgency, trustworthy.",
        },
        {
          id: "trust",
          label: "Build trust",
          ask: "Make this feel safer to tap.",
          rewrite: "Build trust — reassuring, specific, no hype.",
        },
        shorter,
      ];
    }
    return [
      {
        id: "action",
        label: "Drive action",
        ask: "What would make people tap this?",
        rewrite: "Action-driving — clear next step users want to take.",
      },
      clearer,
      shorter,
    ];
  }

  if (element === "headline") {
    if (screen === "home") {
      return [
        {
          id: "hook",
          label: "Stronger hook",
          ask: "Give me a punchier headline.",
          rewrite: "Stronger hook — grab attention in the first few words.",
        },
        {
          id: "benefit",
          label: "Clearer benefit",
          ask: "What's the clearest benefit to lead with?",
          rewrite: "Lead with the clearest user benefit — specific, not generic.",
        },
        shorter,
      ];
    }
    if (screen === "onboarding") {
      return [
        {
          id: "opener",
          label: "Stronger opener",
          ask: "Open stronger — what would you try?",
          rewrite: "Stronger opener — instant clarity on what this app does.",
        },
        friendlier,
        shorter,
      ];
    }
    return [
      {
        id: "hook",
        label: "Stronger hook",
        ask: "Make this headline hit harder.",
        rewrite: "Stronger hook — memorable and specific to this app.",
      },
      clearer,
      shorter,
    ];
  }

  if (element === "role_description") {
    return [
      {
        id: "tempting",
        label: "More tempting",
        ask: "Make picking this role feel more appealing.",
        rewrite:
          "Make choosing this role irresistible — who it's for and why, one short line.",
      },
      {
        id: "who-for",
        label: "Clearer who it's for",
        ask: "Who exactly is this role for?",
        rewrite: "Crystal clear who should pick this role — one short line.",
      },
      shorter,
    ];
  }

  if (element === "role_label") {
    return [
      {
        id: "clear-role",
        label: "Clearer role",
        ask: "Is this role name obvious enough?",
        rewrite: "Clearer role name — instantly obvious who this is for.",
      },
      friendlier,
      shorter,
    ];
  }

  if (element === "list_item") {
    if (vibe === "messaging") {
      return [
        {
          id: "personal",
          label: "More personal",
          ask: "How do I make this feel more personal?",
          rewrite: "More personal and human — like a real conversation starter.",
        },
        {
          id: "warmer",
          label: "Warmer",
          ask: "Warm this up.",
          rewrite: "Warmer tone — inviting, not stiff.",
        },
        shorter,
      ];
    }
    if (vibe === "social") {
      return [
        {
          id: "intriguing",
          label: "Stop the scroll",
          ask: "What would make someone stop scrolling here?",
          rewrite: "Engagement-focused — intriguing enough to tap and read more.",
        },
        {
          id: "relatable",
          label: "More relatable",
          ask: "Make this feel more relatable.",
          rewrite: "More relatable — speaks to how users actually feel.",
        },
        shorter,
      ];
    }
    if (vibe === "browse") {
      return [
        {
          id: "intriguing",
          label: "More intriguing",
          ask: "What would make someone tap this item?",
          rewrite: "More intriguing — clear enough to scan, tempting enough to tap.",
        },
        clearer,
        shorter,
      ];
    }
    return [
      {
        id: "intriguing",
        label: "More intriguing",
        ask: "What would make someone tap this?",
        rewrite: "More intriguing — clear hook that earns a tap.",
      },
      clearer,
      shorter,
    ];
  }

  if (element === "subtext") {
    if (screen === "role_picker") {
      return [
        {
          id: "who-for",
          label: "Clearer who it's for",
          ask: "Who is this line really for?",
          rewrite: "Crystal clear who should pick this — plain language.",
        },
        friendlier,
        shorter,
      ];
    }
    if (screen === "home") {
      return [
        {
          id: "benefit",
          label: "Clearer benefit",
          ask: "What's the benefit in one line?",
          rewrite: "Clearer benefit — why this app matters, one short line.",
        },
        friendlier,
        shorter,
      ];
    }
    return [clearer, friendlier, shorter];
  }

  if (element === "tab_label") {
    return [
      {
        id: "clearer-tab",
        label: "Clearer",
        ask: "Is this tab name obvious?",
        rewrite: "Clearer tab label — users know what they'll find.",
      },
      {
        id: "inviting",
        label: "More inviting",
        ask: "Make this tab feel more inviting.",
        rewrite: "More inviting — friendly, still scannable.",
      },
      shorter,
    ];
  }

  if (element === "tagline") {
    return [
      {
        id: "warmer",
        label: "Warmer",
        ask: "Warm up this tagline.",
        rewrite: "Warmer and more human — still short.",
      },
      {
        id: "personal",
        label: "More personal",
        ask: "Make this feel more like a real person.",
        rewrite: "More personal — sounds like a human, not a brand deck.",
      },
      shorter,
    ];
  }

  if (element === "quote") {
    return [
      {
        id: "relatable",
        label: "More relatable",
        ask: "Make this quote feel more real.",
        rewrite: "More relatable — sounds like a real user, not marketing.",
      },
      {
        id: "punchier",
        label: "Punchier",
        ask: "Punch this up.",
        rewrite: "Punchier — memorable in fewer words.",
      },
      shorter,
    ];
  }

  if (element === "title" && screen === "home") {
    return [
      {
        id: "explore",
        label: "More inviting",
        ask: "How do I get people to explore this section?",
        rewrite: "More inviting section title — curiosity without being vague.",
      },
      clearer,
      shorter,
    ];
  }

  if (element === "settings_row") {
    return [
      {
        id: "clearer-setting",
        label: "Clearer",
        ask: "Is this settings label obvious?",
        rewrite: "Clearer settings label — users know exactly what it does.",
      },
      friendlier,
      shorter,
    ];
  }

  if (screen === "auth") {
    return [
      {
        id: "trust",
        label: "More trustworthy",
        ask: "Does this feel safe to sign up?",
        rewrite: "More trustworthy — reassuring, clear, not corporate.",
      },
      friendlier,
      shorter,
    ];
  }

  return [shorter, friendlier, clearer];
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

export function buildCustomTweakPrompt(
  model: ExpoAppModel,
  target: TweakTarget,
  instruction: string,
  coach?: PreviewCoachContext | null
): string {
  const trimmed = instruction.trim();
  if (!trimmed) {
    return buildTapToAskDraftPrompt(model, target, "", coach);
  }
  return withContext(model, target, trimmed, coach);
}

/** Context-aware chips — screen + element type (3 presets; custom row is always last in UI). */
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

  return contextualChipDefs(model, target).map((def) => chip(model, target, def, coach));
}
