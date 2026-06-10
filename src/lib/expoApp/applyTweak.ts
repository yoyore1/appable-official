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
import {
  applyBuildPatches,
  compileBuildHandoff,
  type CompiledBuildHandoff,
} from "./compileBuildHandoff";
import {
  expandBuildMessageFromContext,
  inferBuildTaskFromContext,
  isBuildExecutionMessage,
  shouldApplyBrainstormPatches,
} from "./resolveBuildIntent";
import { runProjectCodeAgent, shouldUseCodeAgent } from "@/lib/codeAgent";
import { syncWorkspaceAfterModelChange } from "@/lib/codeAgent/syncAfterBuild";
import { tryAuthDebugBuild, tryDeterministicBuildOps } from "./buildAgent";
import { tryBrainstormCoachCopy, trySmartBuildCopy } from "./smartBuildCopy";
import type { PreviewBuildState } from "./previewBuildState";
import type { BrainstormBuildSuggestion, BuildPatchOp } from "@/lib/types";
import { withLegalSettings } from "./smartInteractions";
import type { BrainstormTurn, InterviewTurn } from "@/lib/types";
import {
  capabilityLabel,
  inferBuildReviewScope,
  runCapabilityReview,
  type CapabilityId,
} from "./capabilities";
import {
  applyAppRename,
  isRenameRequest,
  parseRenamePair,
  renameWasApplied,
} from "./appRename";
import { buildAppliedChatReply, BUILD_FAILED_REPLY } from "./buildReply";
import { formatNormieApplyReply } from "./brainstormNormie";
import type { ExpoAppModel } from "./types";
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
  brainstormSummary?: string;
  brainstormHistory?: BrainstormTurn[];
  buildHistory?: BrainstormTurn[];
  /** Pre-compiled handoff from brainstorm → Build. */
  compiledHandoff?: CompiledBuildHandoff;
  buildPatches?: BuildPatchOp[];
  pendingBuild?: BrainstormBuildSuggestion | null;
  interview?: InterviewTurn[];
  projectId?: string;
  /** @deprecated use connectorState */
  supabaseConnected?: boolean;
  connectorState?: ProjectConnectorState;
  connectorNeeds?: ConnectorId[];
  marketplaceSelections?: ConnectorId[];
  /** Server-only: apply Supabase messaging DDL when connected. */
  applyMessagingSchema?: (projectId: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  /** Which preview screen the founder is on when they sent Build. */
  previewState?: PreviewBuildState;
  userId?: string;
  githubRepoUrl?: string | null;
  /** Brainstorm Apply — same Build engine, normie-shaped reply. */
  fromBrainstormApply?: boolean;
}

function isBackendishRequest(message: string): boolean {
  return wantsMessagingBackendWork(message) || wantsAuthPreviewWork(message);
}

export { isBackendBuildRequest } from "./resolveBuildIntent";

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
  const buildHistory = options.buildHistory ?? [];
  const interview = options.interview ?? [];
  const userMessage = message.trim();
  const compiled =
    options.compiledHandoff ??
    compileBuildHandoff({
      history: brainstormHistory,
      model,
      appName: mp.appName,
      userMessage,
      pendingBuild: options.pendingBuild,
      brainstormContext,
      buildHistory,
    });

  const fromBrainstorm =
    Boolean(options.fromBrainstormApply) ||
    shouldApplyBrainstormPatches(userMessage, options.buildPatches);
  const patchesToApply = options.buildPatches?.length
    ? options.buildPatches
    : compiled.patches.length && fromBrainstorm
      ? compiled.patches
      : [];

  const patchResult = applyBuildPatches(model, patchesToApply);
  if (patchResult) {
    const patchesChangedModel =
      options.projectId &&
      JSON.stringify(patchResult.model) !== JSON.stringify(model);
    if (patchesChangedModel) {
      try {
        await syncWorkspaceAfterModelChange(
          options.projectId!,
          model,
          patchResult.model,
          mp
        );
      } catch (err) {
        console.error("[applyExpoTweak] workspace sync failed:", err);
      }
      try {
        const { refreshWorkspacePreview } = await import("@/lib/codeAgent/workspaceRuntime");
        await refreshWorkspacePreview(options.projectId!);
      } catch {
        /* best-effort */
      }
    }
    return finishTweak(
      patchResult.model,
      mp,
      interview,
      patchResult.reply,
      compiled.applyPrompt || userMessage,
      brainstormHistory,
      brainstormContext
    );
  }

  const effectiveMessage =
    fromBrainstorm && compiled.applyPrompt?.trim()
      ? compiled.applyPrompt
      : expandBuildMessageFromContext(
          userMessage,
          brainstormHistory,
          brainstormContext,
          options.pendingBuild?.prompt,
          buildHistory
        );
  const renamePair = parseRenamePair(effectiveMessage);

  const wrap = async (m: ExpoAppModel, reply: string) => {
    const modelChanged = JSON.stringify(m) !== JSON.stringify(model);
    const renameOk =
      !renamePair || !modelChanged || renameWasApplied(model, m, renamePair, mp.appName);

    if (renamePair && modelChanged && !renameOk) {
      return finishTweak(
        model,
        mp,
        interview,
        BUILD_FAILED_REPLY,
        effectiveMessage,
        brainstormHistory,
        brainstormContext
      );
    }

    if (modelChanged && options.projectId) {
      try {
        await syncWorkspaceAfterModelChange(options.projectId, model, m, mp);
      } catch (err) {
        console.error("[applyExpoTweak] workspace sync failed:", err);
      }
      try {
        const { refreshWorkspacePreview } = await import("@/lib/codeAgent/workspaceRuntime");
        await refreshWorkspacePreview(options.projectId);
      } catch {
        /* preview refresh is best-effort — change is already saved */
      }
    }
    const outReply =
      modelChanged && renameOk
        ? buildAppliedChatReply()
        : options.fromBrainstormApply
          ? formatNormieApplyReply(reply, false)
          : reply;
    return finishTweak(
      m,
      mp,
      interview,
      outReply,
      effectiveMessage,
      brainstormHistory,
      brainstormContext
    );
  };
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

  if (wantsMessagingBackendWork(effectiveMessage)) {
    if (/read receipt/.test(effectiveMessage.toLowerCase())) {
      return await wrap(
        model,
        "Skipping read receipts for v1 — they add pressure and extra schema. " +
          "Build wired simple chat (sender_id + text) instead. Say “wire messaging” if you want the Messages tab + tables."
      );
    }

    if (!supabaseConnected) {
      return await wrap(
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

    return await wrap(wired.model, reply);
  }

  if (wantsAuthPreviewWork(effectiveMessage) || routing.supabaseWire) {
    if (!supabaseConnected) {
      return await wrap(
        model,
        "I can add sign-up and sign-in to the preview once Supabase is linked — open **Connections → Connect Supabase** on the right, then tell me again."
      );
    }
    const auth = wireSupabaseAuthInPreview(model, mp);
    return await wrap(auth.model, auth.reply);
  }

  if (
    /sign[\s-]?out|delete account|account controls/.test(effectiveMessage.toLowerCase()) &&
    !wantsMessagingBackendWork(effectiveMessage)
  ) {
    const next = withLegalSettings(model);
    return await wrap(
      next,
      "Done — Profile settings now include Sign out and Delete account."
    );
  }

  const ruled = tryRules(model, effectiveMessage);
  if (ruled) return await wrap(ruled.model, ruled.reply);

  const authDebug = tryAuthDebugBuild(model, mp, userMessage, connectorState);
  if (authDebug) {
    if ("model" in authDebug) {
      return await wrap(authDebug.model, authDebug.reply);
    }
    return await wrap(model, authDebug.reply);
  }

  const structural = tryDeterministicBuildOps(model, effectiveMessage, options.previewState);
  if (structural?.kind === "applied") {
    return await wrap(structural.model, structural.reply);
  }

  if (renamePair) {
    const renamed = applyAppRename(model, renamePair, mp.appName);
    if (renamed) {
      return await wrap(renamed, "Done.");
    }
  }

  if (fromBrainstorm) {
    const coachCopy = tryBrainstormCoachCopy(model, effectiveMessage, brainstormHistory);
    if (coachCopy?.kind === "applied") {
      return await wrap(coachCopy.model, coachCopy.reply);
    }
  }

  const smartCopy = await trySmartBuildCopy(
    model,
    mp,
    effectiveMessage,
    interview,
    brainstormHistory,
    options.previewState
  );
  if (smartCopy?.kind === "applied") {
    return await wrap(smartCopy.model, smartCopy.reply);
  }
  if (smartCopy?.kind === "clarify") {
    return await wrap(model, smartCopy.reply);
  }

  if (
    options.projectId &&
    (isRenameRequest(effectiveMessage) ||
      shouldUseCodeAgent(effectiveMessage, {
        fromBrainstormApply: options.fromBrainstormApply,
        projectId: options.projectId,
      }))
  ) {
    const code = await runProjectCodeAgent({
      projectId: options.projectId,
      model,
      mp,
      message: effectiveMessage,
      previewState: options.previewState,
      buildHistory,
      brainstormHistory,
      brainstormContext,
      interview,
      githubRepoUrl: options.githubRepoUrl,
      userId: options.userId,
      appName: mp.appName,
    });
    if (code?.kind === "applied") {
      return await wrap(code.model, code.reply);
    }
    if (code?.kind === "clarify") {
      return await wrap(model, code.reply);
    }
    if (!code) {
      return await wrap(
        model,
        "Build workspace agent isn't available — check server config (FIREWORKS_API_KEY, CODE_AGENT)."
      );
    }
  } else if (
    shouldUseCodeAgent(effectiveMessage, {
      fromBrainstormApply: options.fromBrainstormApply,
      projectId: options.projectId,
    })
  ) {
    return await wrap(
      model,
      "Build needs a project workspace to edit files — refresh and try again."
    );
  }

  const task = inferBuildTaskFromContext(brainstormHistory);

  if (task === "messaging") {
    if (!supabaseConnected) {
      return await wrap(
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
    return await wrap(wired.model, finalReply);
  }

  if (task === "auth" && supabaseConnected) {
    const auth = wireSupabaseAuthInPreview(model, mp);
    return await wrap(auth.model, auth.reply);
  }

  if (task === "auth" && !supabaseConnected) {
    return await wrap(
      model,
      "Connect Supabase in Connections first, then ask Build to wire sign-up and sign-in."
    );
  }

  if (task === "sign_out") {
    return await wrap(
      withLegalSettings(model),
      "Done — Profile settings now include Sign out and Delete account."
    );
  }

  return await wrap(
    model,
    isBackendishRequest(effectiveMessage)
      ? "Try: “wire messaging” or “add sign-up and sign-in with Supabase” — Build handles backend and UI."
      : "I couldn't apply that yet — try again with a specific change, e.g. “remove the Cart tab” or “add Open/Matched/Done chips on Home walk cards.”"
  );
}
