import { chatReply } from "@/lib/models";
import type { MasterBuildPrompt } from "@/lib/types";
import {
  buildConnectorRouting,
  type ConnectorId,
  type ProjectConnectorState,
} from "@/lib/connectors/registry";
import {
  wantsAuthPreviewWork,
  wantsMessagingBackendWork,
  wireMessagingInPreview,
} from "./applyMessagingPreview";
import { wireSupabaseAuthInPreview } from "./applySupabasePreview";
import { buildAgentBuiltStateBlock } from "./builtState";
import {
  buildCopyUpdateFromCoach,
  expandBuildMessageFromContext,
  inferBuildTaskFromContext,
  isBuildExecutionMessage,
  tryApplyRoleCopyFromMessage,
} from "./resolveBuildIntent";
import { withLegalSettings } from "./smartInteractions";
import type { BrainstormTurn, InterviewTurn } from "@/lib/types";
import {
  capabilityLabel,
  inferBuildReviewScope,
  runCapabilityReview,
  type CapabilityId,
} from "./capabilities";
import type { ExpoAppModel } from "./types";
import { founderVoiceBlock } from "./founderVoice";

const THINKING =
  /user says|the user|i need to|first,|let me|might be|could be|console error|dev tools/i;

function finishTweak(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  interview: InterviewTurn[],
  reply: string,
  effectiveMessage: string,
  brainstormHistory: BrainstormTurn[],
  brainstormContext?: string
): { model: ExpoAppModel; reply: string } {
  const scopeResult = inferBuildReviewScope(
    effectiveMessage,
    mp,
    interview,
    brainstormHistory,
    brainstormContext
  );
  if (scopeResult === "skip") {
    return { model, reply };
  }

  const reviewed = runCapabilityReview(model, mp, interview, 2, { scope: scopeResult });
  if (reviewed.autoFixed.length === 0) {
    return { model: reviewed.model, reply };
  }
  const labels = reviewed.autoFixed
    .map((id) => capabilityLabel(id as CapabilityId))
    .filter(Boolean)
    .join(", ");
  if (!labels.trim()) {
    return { model: reviewed.model, reply };
  }
  const extra = ` Completed ${labels} for this change.`;
  const combined = reply.includes("Completed ") ? reply : `${reply.trim()}${extra}`;
  return { model: reviewed.model, reply: combined.slice(0, 360) };
}

export interface ApplyExpoTweakOptions {
  brainstormContext?: string;
  brainstormHistory?: BrainstormTurn[];
  interview?: InterviewTurn[];
  projectId?: string;
  /** @deprecated use connectorState */
  supabaseConnected?: boolean;
  connectorState?: ProjectConnectorState;
  connectorNeeds?: ConnectorId[];
  marketplaceSelections?: ConnectorId[];
  /** Server-only: apply Supabase messaging DDL when connected. */
  applyMessagingSchema?: (projectId: string) => Promise<{ ok: true } | { ok: false; message: string }>;
}

function isBackendishRequest(message: string): boolean {
  return wantsMessagingBackendWork(message) || wantsAuthPreviewWork(message);
}

function cleanReply(text: string, message: string): string {
  const backend = isBackendishRequest(message);
  const t = text.trim();
  if (!t || THINKING.test(t)) {
    return backend
      ? "I couldn't apply that yet — connect Supabase in Connections if you need live tables, then ask Build again with specifics."
      : "I couldn't change the preview from that — try rephrasing (e.g. “wire messaging” or “shorten the home headline”).";
  }
  const first = t.split(/\n+/).find((line) => line.trim() && !THINKING.test(line)) ?? t;
  return first.slice(0, 280);
}

/** @deprecated use wantsAuthPreviewWork — kept for brainstorm handoff filter */
export function isBackendBuildRequest(message: string): boolean {
  return wantsAuthPreviewWork(message) || wantsMessagingBackendWork(message);
}

function tryRules(
  model: ExpoAppModel,
  msg: string
): { model: ExpoAppModel; reply: string } | null {
  if (isBuildExecutionMessage(msg) || isBackendishRequest(msg)) {
    return null;
  }

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

/** Apply a post-build tweak — preview UI, Supabase auth, messaging tables + chat UI. */
export async function applyExpoTweak(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  message: string,
  options: ApplyExpoTweakOptions = {}
): Promise<{ model: ExpoAppModel; reply: string }> {
  const brainstormContext = options.brainstormContext;
  const brainstormHistory = options.brainstormHistory ?? [];
  const interview = options.interview ?? [];
  const userMessage = message.trim();
  const effectiveMessage = expandBuildMessageFromContext(
    userMessage,
    brainstormHistory,
    brainstormContext
  );
  const wrap = (m: ExpoAppModel, reply: string) =>
    finishTweak(
      m,
      mp,
      interview,
      reply,
      effectiveMessage,
      brainstormHistory,
      brainstormContext
    );
  const builtStateNote = buildAgentBuiltStateBlock(model);

  const connectorState: ProjectConnectorState =
    options.connectorState ??
    ({
      supabase: options.supabaseConnected
        ? ({ status: "connected", projectName: "", projectRef: "", url: "", connectedAt: "", schemaVersion: 1 })
        : null,
      revenueCat: null,
      railway: null,
      sdk: {},
    } satisfies ProjectConnectorState);
  const connectorSuggestions = options.connectorNeeds ?? [];
  const marketplaceSelections = options.marketplaceSelections ?? [];
  const supabaseConnected =
    Boolean(connectorState.supabase) && connectorState.supabase!.status !== "disconnected";

  const routing = buildConnectorRouting(
    effectiveMessage,
    connectorState,
    connectorSuggestions,
    marketplaceSelections
  );
  if (routing.connectorReply) {
    return wrap(model, routing.connectorReply);
  }

  if (wantsMessagingBackendWork(effectiveMessage)) {
    if (/read receipt/.test(effectiveMessage.toLowerCase())) {
      return wrap(
        model,
        "Skipping read receipts for v1 — they add pressure and extra schema. " +
          "Build wired simple chat (sender_id + text) instead. Say “wire messaging” if you want the Messages tab + tables."
      );
    }

    if (!supabaseConnected) {
      return wrap(
        model,
        "Messaging needs Supabase — open **Connections → Connect Supabase**, then ask Build to “wire messaging” (preview UI + conversations/messages tables)."
      );
    }

    const wired = wireMessagingInPreview(model, mp);
    let reply = wired.reply;

    if (options.projectId && options.applyMessagingSchema) {
      const schema = await options.applyMessagingSchema(options.projectId);
      if (schema.ok) {
        reply += " Created appable_conversations + appable_messages in your Supabase project.";
      } else {
        reply += ` Preview is ready — ${schema.message}`;
      }
    }

    return wrap(wired.model, reply);
  }

  if (wantsAuthPreviewWork(effectiveMessage) || routing.supabaseWire) {
    if (!supabaseConnected) {
      return wrap(
        model,
        "I can add sign-up and sign-in to the preview once Supabase is linked — open **Connections → Connect Supabase** on the right, then tell me again."
      );
    }
    const auth = wireSupabaseAuthInPreview(model, mp);
    return wrap(auth.model, auth.reply);
  }

  if (
    /sign[\s-]?out|delete account|account controls/.test(effectiveMessage.toLowerCase()) &&
    !wantsMessagingBackendWork(effectiveMessage)
  ) {
    const next = withLegalSettings(model);
    return wrap(
      next,
      "Done — Profile settings now include Sign out and Delete account."
    );
  }

  const ruled = tryRules(model, effectiveMessage);
  if (ruled) return wrap(ruled.model, ruled.reply);

  const roleCopy = tryApplyRoleCopyFromMessage(model, effectiveMessage);
  if (roleCopy) return wrap(roleCopy.model, roleCopy.reply);

  const contextBlock = [
    builtStateNote,
    brainstormContext?.trim()
      ? `Brainstorm context (user may reference "what we discussed"):\n${brainstormContext.trim()}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const userPrompt =
    effectiveMessage !== userMessage
      ? `User said: "${userMessage}" (means: ${effectiveMessage})`
      : `User request: ${userMessage}`;

  const llm = await chatReply(
    `You are the BUILD agent for ${mp.appName}. The user is the founder/dev building this app — implement the product they own, not end-user business flows. ` +
      `${founderVoiceBlock(mp.appName)} ` +
      `You change the live preview AND wire backend when Supabase is connected. ` +
      `You can: UI copy/colors/tabs, sign-up + sign-in/auth, messaging tables + Messages tab, profile settings. ` +
      `Follow INTEGRATION IMPLEMENTATION PLAYBOOKS in Connections context — wire SDK config for integrations on the project plan (never invent keys). ` +
      `NEVER remove existing tabs when adding features — append a tab or reuse Alerts/Notifications. ` +
      `Use recent brainstorm context when the user says yes/ready/proceed — execute what you were just planning. ` +
      `Reply with ONE short sentence (max 35 words) confirming what you did.` +
      (contextBlock ? `\n\n${contextBlock}` : ""),
    `Current headline: "${model.home.headline}". ${userPrompt}`,
    120
  );

  if (llm && /headline|title|home/.test(effectiveMessage.toLowerCase())) {
    const quoted = llm.match(/"([^"]+)"/)?.[1];
    if (quoted) {
      return wrap(
        { ...model, home: { ...model.home, headline: quoted } },
        cleanReply(`Home headline → "${quoted}"`, effectiveMessage)
      );
    }
  }

  const reply = cleanReply(llm, effectiveMessage);
  const soundsGeneric =
    /save is on every card|open any card|tap around|try tapping|collection button|only do visual|shorten the home headline|didn't change the preview/i.test(
      reply
    );
  if (soundsGeneric) {
    const roleCopyFallback = tryApplyRoleCopyFromMessage(model, effectiveMessage);
    if (roleCopyFallback) return wrap(roleCopyFallback.model, roleCopyFallback.reply);

    const lastCoach = [...brainstormHistory]
      .reverse()
      .find((t) => t.role === "assistant")?.content;
    const pendingCopy = lastCoach ? buildCopyUpdateFromCoach(lastCoach) : null;
    if (pendingCopy) {
      const applied = tryApplyRoleCopyFromMessage(model, pendingCopy);
      if (applied) return wrap(applied.model, applied.reply);
    }

    const task = inferBuildTaskFromContext(brainstormHistory);

    if (task === "messaging" && pendingCopy) {
      return wrap(
        model,
        "That brainstorm was about copy on the role picker — not messaging. " +
          "Try Build again with: update the role descriptions we discussed."
      );
    }

    if (task === "messaging") {
      if (!supabaseConnected) {
        return wrap(
          model,
          "Messaging needs Supabase — connect it in Connections, then ask Build to “wire messaging”."
        );
      }
      const wired = wireMessagingInPreview(model, mp);
      let finalReply = wired.reply;
      if (options.projectId && options.applyMessagingSchema) {
        const schema = await options.applyMessagingSchema(options.projectId);
        if (schema.ok) {
          finalReply += " Created appable_conversations + appable_messages in Supabase.";
        } else {
          finalReply += ` ${schema.message}`;
        }
      }
      return wrap(wired.model, finalReply);
    }

    if (task === "auth" && supabaseConnected) {
      const auth = wireSupabaseAuthInPreview(model, mp);
      return wrap(auth.model, auth.reply);
    }

    if (task === "auth" && !supabaseConnected) {
      return wrap(
        model,
        "Connect Supabase in Connections first, then ask Build to wire sign-up and sign-in."
      );
    }

    if (task === "sign_out") {
      return wrap(
        withLegalSettings(model),
        "Done — Profile settings now include Sign out and Delete account."
      );
    }

    return wrap(
      model,
      isBackendishRequest(effectiveMessage)
        ? "Try: “wire messaging” or “add sign-up and sign-in with Supabase” — Build handles backend and UI."
        : userMessage !== effectiveMessage
          ? `Working on what we discussed — if nothing changed, say “wire messaging” or “create the tables”.`
          : "I didn't change the preview for that — try something specific (headline, colors, messaging, or auth)."
    );
  }

  return wrap(model, reply);
}
