import { chatReply } from "@/lib/models";
import type { MasterBuildPrompt } from "@/lib/types";
import {
  buildConnectorRouting,
  type ConnectorId,
  type ProjectConnectorState,
} from "@/lib/connectors/registry";
import {
  wantsSupabasePreviewWork,
  wireSupabaseAuthInPreview,
} from "./applySupabasePreview";
import type { ExpoAppModel } from "./types";

const THINKING =
  /user says|the user|i need to|first,|let me|might be|could be|console error|dev tools/i;

export interface ApplyExpoTweakOptions {
  brainstormContext?: string;
  /** @deprecated use connectorState */
  supabaseConnected?: boolean;
  connectorState?: ProjectConnectorState;
  connectorNeeds?: ConnectorId[];
}

function cleanReply(text: string): string {
  const t = text.trim();
  if (!t || THINKING.test(t)) {
    return "I couldn't change the preview from that — try something visual, like “shorten the home headline.”";
  }
  const first = t.split(/\n+/).find((line) => line.trim() && !THINKING.test(line)) ?? t;
  return first.slice(0, 200);
}

/** @deprecated use wantsSupabasePreviewWork — kept for brainstorm handoff filter */
export function isBackendBuildRequest(message: string): boolean {
  return wantsSupabasePreviewWork(message);
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

  if (
    /save|favorite|bookmark/.test(m) &&
    !/save that|save the|flag|onboarding|user in|account|backend|supabase/.test(m)
  ) {
    return {
      model,
      reply: "Save is on every card — open an item and tap Save.",
    };
  }

  if (
    /collection|grocery list|shopping list|add to list/.test(m) ||
    (/list tab|my list/.test(m) && /card|item/.test(m))
  ) {
    return {
      model,
      reply: "Open any card → use the collection button to push items to your list tab.",
    };
  }

  return null;
}

/** Apply a post-build tweak — preview UI + Supabase sign-up wiring in the web preview. */
export async function applyExpoTweak(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  message: string,
  options: ApplyExpoTweakOptions = {}
): Promise<{ model: ExpoAppModel; reply: string }> {
  const brainstormContext = options.brainstormContext;
  const connectorState: ProjectConnectorState =
    options.connectorState ??
    ({
      supabase: options.supabaseConnected
        ? ({ status: "connected", projectName: "", projectRef: "", url: "", connectedAt: "", schemaVersion: 1 })
        : null,
      revenueCat: null,
      railway: null,
    } satisfies ProjectConnectorState);
  const connectorNeeds = options.connectorNeeds ?? ["supabase"];

  const routing = buildConnectorRouting(message, connectorState, connectorNeeds);
  if (routing.connectorReply) {
    return { model, reply: routing.connectorReply };
  }

  if (wantsSupabasePreviewWork(message) || routing.supabaseWire) {
    if (!connectorState.supabase || connectorState.supabase.status === "disconnected") {
      return {
        model,
        reply:
          "I can add sign-up to the preview once Supabase is linked — open **Connections → Connect Supabase** on the right, then tell me again.",
      };
    }
    return wireSupabaseAuthInPreview(model, mp);
  }

  const ruled = tryRules(model, message);
  if (ruled) return ruled;

  const contextBlock = brainstormContext?.trim()
    ? `\n\nBrainstorm context (user may reference "what we discussed"):\n${brainstormContext.trim()}`
    : "";

  const llm = await chatReply(
    `You are the BUILD agent for ${mp.appName}'s live preview. You change demo UI (headlines, colors, tab labels, copy). ` +
      `Follow CONNECTOR ROUTING in brainstorm context — right connector in Connections, not random tools. ` +
      `Otherwise reply with ONE short sentence (max 25 words) confirming a preview change, or say what to try. ` +
      `NEVER mention Save on cards unless they asked about saving favorites.` +
      contextBlock,
    `Current headline: "${model.home.headline}". User request: ${message}`,
    100
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

  const reply = cleanReply(llm);
  const soundsGeneric =
    /save is on every card|open any card|tap around|try tapping|collection button/i.test(
      reply
    );
  if (soundsGeneric) {
    return {
      model,
      reply:
        "I didn't change the preview for that. Try a visual tweak — e.g. “shorten the home headline” or “make the accent brighter.”",
    };
  }

  return { model, reply };
}
