import { chatReply } from "@/lib/models";
import type { MasterBuildPrompt } from "@/lib/types";
import type { ExpoAppModel } from "./types";

const THINKING =
  /user says|the user|i need to|first,|let me|might be|could be|console error|dev tools/i;

function cleanReply(text: string): string {
  const t = text.trim();
  if (!t || THINKING.test(t)) {
    return "Updated — check the preview on the right.";
  }
  const first = t.split(/\n+/).find((line) => line.trim() && !THINKING.test(line)) ?? t;
  return first.slice(0, 140);
}

function tryRules(
  model: ExpoAppModel,
  msg: string
): { model: ExpoAppModel; reply: string } | null {
  const m = msg.toLowerCase();

  if (/profile|settings/.test(m) && /work|fix|button|tap|click|broken|none/.test(m)) {
    return {
      model,
      reply: "Profile settings open now — tap any row in Profile.",
    };
  }

  if (/headline/.test(m) && /short|smaller|brief/.test(m)) {
    const words = model.home.headline.split(/\s+/).slice(0, 4);
    const headline = words.join(" ");
    return {
      model: { ...model, home: { ...model.home, headline } },
      reply: `Home headline → "${headline}"`,
    };
  }

  if (/accent|coral|color|palette/.test(m) && /more|brighter|bold/.test(m)) {
    const accent = model.theme.accent === "#FF7A63" ? "#E85D48" : "#FF7A63";
    return {
      model: {
        ...model,
        theme: { ...model.theme, accent },
      },
      reply: "Bumped accent color in the preview.",
    };
  }

  if (/save|favorite|bookmark/.test(m)) {
    return {
      model,
      reply: "Save is on every card — open an item and tap Save.",
    };
  }

  if (/list|grocery|shop|cart|plan|collection|link|connect|button/.test(m)) {
    return {
      model,
      reply: "Open any card → use the collection button to push items to your list tab.",
    };
  }

  return null;
}

/** Apply a post-build tweak — rules first, tiny LLM patch only if needed. */
export async function applyExpoTweak(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  message: string
): Promise<{ model: ExpoAppModel; reply: string }> {
  const ruled = tryRules(model, message);
  if (ruled) return ruled;

  const llm = await chatReply(
    `You patch a mobile app preview for ${mp.appName}. Reply with ONE short user-facing sentence (max 20 words) confirming what changed. ` +
      `If you cannot change anything, say "Try: shorten the home headline." NEVER analyze or explain your reasoning.`,
    `Current headline: "${model.home.headline}". User request: ${message}`,
    60
  );

  if (llm && /headline|title|home/.test(message.toLowerCase())) {
    const quoted = llm.match(/"([^"]+)"/)?.[1];
    if (quoted) {
      return {
        model: { ...model, home: { ...model.home, headline: quoted } },
        reply: cleanReply(`Home headline → "${quoted}"`),
      };
    }
  }

  return { model, reply: cleanReply(llm || "Got it — open the preview and try tapping around.") };
}
