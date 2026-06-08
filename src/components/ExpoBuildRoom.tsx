"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Loader2,
  MousePointer2,
  Pencil,
  Pin,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { AiBudgetBar } from "@/components/AiBudgetBar";
import { BuildModeToggle } from "@/components/BuildModeToggle";
import { PreviewFixPanel } from "@/components/PreviewFixPanel";
import { ExpoLivePreview } from "@/components/ExpoLivePreview";
import { ExpoPhoneGuide } from "@/components/ExpoPhoneGuide";
import { PreviewCanvasPicker } from "@/components/PreviewCanvasPicker";
import { FloatingBuildHandoff } from "@/components/FloatingBuildHandoff";
import { BuildSidePanel } from "@/components/BuildSidePanel";
import { ReadinessSuggestionBar } from "@/components/ReadinessSuggestionBar";
import { resolveBuildHandoff } from "@/lib/expoApp/buildHandoff";
import { defaultBrainstormState } from "@/lib/expoApp/brainstormContext";
import { TypingIndicator } from "@/components/TypingIndicator";
import { formatBuildRecap } from "@/lib/expoApp/buildRecap";
import { applyConnectorsToAudit } from "@/lib/connectors/readinessConnector";
import { enrichOAuthSetupStatus } from "@/lib/expoApp/oauthReadiness";
import {
  getConnectorRecommendations,
  inferConnectorNeeds,
  mergeConnectorNeeds,
  type ConnectorRecommendation,
} from "@/lib/connectors/registry";
import {
  auditAppReadiness,
  defaultReadinessState,
  enrichAuditWithState,
  formatReadinessChecklist,
  formatReadinessIntro,
  getReadinessSuggestions,
  type ReadinessDecision,
  type ReadinessItem,
  type ReadinessSuggestion,
} from "@/lib/expoApp/readinessAudit";
import { expoBuildMicroSteps } from "@/lib/expoBuildProgress";
import { planChecklist } from "@/lib/expoPreviewTheme";
import type { SelectionTweakAction } from "@/lib/expoApp/applySelectionTweak";
import { getStringAtPath, type TweakTarget } from "@/lib/expoApp/tweakPaths";
import type { ExpoAppModel } from "@/lib/expoApp/types";
import {
  clearBrainstormBuildSuggestion,
  expoBrainstormChat,
  expoSelectionTweak,
  expoTweakChat,
  patchProjectReadiness,
  prepareExpoBuild,
  runExpoWebBuild,
  updateExpoPlan,
} from "@/server/projects";
import type {
  BrainstormTurn,
  InterviewTurn,
  MasterBuildPrompt,
  ProjectBrainstormState,
  ProjectReadinessState,
  RailwayConnectorPublic,
  RevenueCatConnectorPublic,
  SupabaseConnectorPublic,
} from "@/lib/types";

type Phase = "summary" | "edit" | "building" | "done";

type Bubble = {
  id: string;
  role: "ai" | "user";
  text: string;
  brainstorm?: boolean;
  /** Live brainstorm thread — replaced from server, not appended one-by-one. */
  brainstormChat?: boolean;
};
type ChatMode = "brainstorm" | "build";

function brainstormHistoryToBubbles(history: BrainstormTurn[]): Bubble[] {
  return history.map((turn, i) => ({
    id: `bchat-${i}-${turn.role}`,
    role: turn.role === "user" ? "user" : "ai",
    text: turn.content,
    brainstorm: true,
    brainstormChat: true,
  }));
}

function mergeBrainstormBubbles(prev: Bubble[], history: BrainstormTurn[]) {
  const intro = prev.filter((b) => !b.brainstormChat);
  return [...intro, ...brainstormHistoryToBubbles(history)];
}

export function ExpoBuildRoom({
  projectId,
  initialPlan,
  initialModel,
  interview = [],
  showWatermark = false,
  previewToken,
  initialReadinessState,
  initialBrainstormState,
  initialSupabaseConnector = null,
  initialRevenueCatConnector = null,
  initialRailwayConnector = null,
  className = "",
}: {
  projectId: string;
  initialPlan: MasterBuildPrompt;
  initialModel?: ExpoAppModel | null;
  interview?: InterviewTurn[];
  showWatermark?: boolean;
  previewToken: string | null;
  initialReadinessState?: ProjectReadinessState | null;
  initialBrainstormState?: ProjectBrainstormState | null;
  initialSupabaseConnector?: SupabaseConnectorPublic | null;
  initialRevenueCatConnector?: RevenueCatConnectorPublic | null;
  initialRailwayConnector?: RailwayConnectorPublic | null;
  className?: string;
}) {
  const [plan, setPlan] = useState(initialPlan);
  const [appModel, setAppModel] = useState<ExpoAppModel | null>(initialModel ?? null);
  const [phase, setPhase] = useState<Phase>(initialModel ? "done" : "summary");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [busy, setBusy] = useState(false);
  const [buildPercent, setBuildPercent] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [buildLabels, setBuildLabels] = useState<string[]>([]);
  const [tweakInput, setTweakInput] = useState("");
  const [chatMode, setChatMode] = useState<ChatMode>("brainstorm");
  const [brainstormState, setBrainstormState] = useState<ProjectBrainstormState>(
    () => initialBrainstormState ?? defaultBrainstormState()
  );
  const [fixMode, setFixMode] = useState(false);
  const [fixTarget, setFixTarget] = useState<TweakTarget | null>(null);
  const [fixBusy, setFixBusy] = useState(false);
  const [budgetKey, setBudgetKey] = useState(0);
  const [readinessState, setReadinessState] = useState<ProjectReadinessState>(
    () => initialReadinessState ?? defaultReadinessState()
  );
  const [supabaseConnector, setSupabaseConnector] =
    useState<SupabaseConnectorPublic | null>(initialSupabaseConnector);
  const [revenueCatConnector, setRevenueCatConnector] =
    useState<RevenueCatConnectorPublic | null>(initialRevenueCatConnector);
  const [railwayConnector, setRailwayConnector] =
    useState<RailwayConnectorPublic | null>(initialRailwayConnector);
  const endRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatSubmittingRef = useRef(false);

  function resizeChatInput() {
    const el = chatInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }
  const buildTimers = useRef<ReturnType<typeof setInterval>[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const serverPercentRef = useRef(0);
  const microSteps = useMemo(
    () => expoBuildMicroSteps(plan, interview),
    [plan, interview]
  );

  const baseReadinessAudit = useMemo(
    () => (appModel ? auditAppReadiness(appModel, plan, interview) : null),
    [appModel, plan, interview]
  );

  const inferredConnectorNeeds = useMemo(
    () =>
      inferConnectorNeeds({
        mp: plan,
        interview,
        audit: baseReadinessAudit,
      }),
    [plan, interview, baseReadinessAudit]
  );

  const lastUserBrainstorm = useMemo(() => {
    for (let i = brainstormState.history.length - 1; i >= 0; i--) {
      if (brainstormState.history[i]?.role === "user") {
        return brainstormState.history[i]!.content;
      }
    }
    return "";
  }, [brainstormState.history]);

  const connectorNeeds = useMemo(
    () => mergeConnectorNeeds(inferredConnectorNeeds, lastUserBrainstorm),
    [inferredConnectorNeeds, lastUserBrainstorm]
  );

  const connectorRecommendations = useMemo((): ConnectorRecommendation[] => {
    return getConnectorRecommendations(
      { supabase: supabaseConnector, revenueCat: revenueCatConnector, railway: railwayConnector },
      connectorNeeds
    );
  }, [supabaseConnector, revenueCatConnector, railwayConnector, connectorNeeds]);

  const readinessAudit = useMemo(() => {
    if (!baseReadinessAudit) return null;
    const withState = enrichAuditWithState(
      baseReadinessAudit,
      readinessState,
      readinessState.pinnedItemId
    );
    const withConnectors = applyConnectorsToAudit(
      withState,
      supabaseConnector,
      revenueCatConnector,
      railwayConnector
    );
    const authInPreview = Boolean(appModel?.flow?.auth?.enabled);
    return enrichOAuthSetupStatus(withConnectors, authInPreview, readinessState);
  }, [
    baseReadinessAudit,
    readinessState,
    supabaseConnector,
    revenueCatConnector,
    railwayConnector,
    appModel?.flow?.auth?.enabled,
  ]);

  const pinnedItem = useMemo(
    () =>
      readinessAudit?.items.find((i) => i.id === readinessState.pinnedItemId) ?? null,
    [readinessAudit, readinessState.pinnedItemId]
  );

  const readinessSuggestions = useMemo(
    () => (readinessAudit ? getReadinessSuggestions(readinessAudit) : []),
    [readinessAudit]
  );

  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null);

  const highlightedSuggestionId = useMemo(() => {
    if (
      activeSuggestionId &&
      readinessSuggestions.some((s) => s.id === activeSuggestionId)
    ) {
      return activeSuggestionId;
    }
    const pinnedMatch = readinessSuggestions.find(
      (s) => s.itemId === readinessState.pinnedItemId
    );
    if (pinnedMatch) return pinnedMatch.id;
    return readinessSuggestions[0]?.id ?? null;
  }, [activeSuggestionId, readinessSuggestions, readinessState.pinnedItemId]);

  const buildHandoff = useMemo(
    () =>
      resolveBuildHandoff({
        history: brainstormState.history,
      }),
    [brainstormState.history]
  );

  function pickReadinessSuggestion(suggestion: ReadinessSuggestion) {
    setActiveSuggestionId(suggestion.id);
    setTweakInput(
      chatMode === "build" ? suggestion.buildPrompt : suggestion.prompt
    );

    const item = readinessAudit?.items.find((i) => i.id === suggestion.itemId);
    if (item) {
      setReadinessState((s) => ({ ...s, pinnedItemId: item.id }));
      void patchProjectReadiness(projectId, { pinnedItemId: item.id }).then((res) => {
        if (res.ok) setReadinessState(res.state);
      });
    }

    requestAnimationFrame(() => chatInputRef.current?.focus());
  }

  function askAboutReadiness(item: ReadinessItem) {
    setChatMode("brainstorm");
    setTweakInput(`What do I need for "${item.title}"?`);
    const match = readinessSuggestions.find((s) => s.itemId === item.id);
    if (match) setActiveSuggestionId(match.id);
    setReadinessState((s) => ({ ...s, pinnedItemId: item.id }));
    void patchProjectReadiness(projectId, { pinnedItemId: item.id }).then((res) => {
      if (res.ok) setReadinessState(res.state);
    });
  }

  function setReadinessDecision(item: ReadinessItem, decision: ReadinessDecision) {
    const current = readinessState.items[item.id]?.decision ?? null;
    const nextDecision = current === decision ? null : decision;

    setReadinessState((s) => ({
      ...s,
      pinnedItemId: item.id,
      items: {
        ...s.items,
        [item.id]: {
          discussed: true,
          discussedAt: new Date().toISOString(),
          decision: nextDecision,
        },
      },
    }));
    void patchProjectReadiness(projectId, {
      itemId: item.id,
      discussed: true,
      decision: nextDecision,
      pinnedItemId: item.id,
    }).then((res) => {
      if (res.ok) setReadinessState(res.state);
    });
  }

  function clearPinnedReadiness() {
    setReadinessState((s) => ({ ...s, pinnedItemId: null }));
    void patchProjectReadiness(projectId, { pinnedItemId: null }).then((res) => {
      if (res.ok) setReadinessState(res.state);
    });
  }

  function markPinnedDiscussed(itemId: string) {
    void patchProjectReadiness(projectId, { itemId, discussed: true }).then((res) => {
      if (res.ok) setReadinessState(res.state);
    });
  }

  function submitBuildMessage(msg: string) {
    const trimmed = msg.trim();
    if (!trimmed || busy || chatSubmittingRef.current) return;

    setBusy(true);
    chatSubmittingRef.current = true;
    setBubbles((b) => [...b, { id: `tu-${Date.now()}`, role: "user", text: trimmed }]);

    void expoTweakChat(projectId, trimmed)
      .then((res) => {
        if (res.ok) setAppModel(res.model);
        setBudgetKey((k) => k + 1);
        setBubbles((b) => [
          ...b,
          {
            id: `ta-${Date.now()}`,
            role: "ai",
            text: res.ok ? res.reply : res.message,
          },
        ]);
      })
      .finally(() => {
        setBusy(false);
        chatSubmittingRef.current = false;
      });
  }

  function handoffToBuildAndRun(prompt: string) {
    setChatMode("build");
    setTweakInput("");
    setBrainstormState((s) => ({ ...s, pendingBuild: null }));
    void clearBrainstormBuildSuggestion(projectId).then((res) => {
      if (res.ok) setBrainstormState(res.brainstormState);
    });
    submitBuildMessage(prompt);
  }

  const [editForm, setEditForm] = useState({
    appName: plan.appName,
    description: plan.description,
    audience: plan.audience,
    features: plan.features.join("\n"),
    colors: plan.colors,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles, phase, buildPercent]);

  useEffect(() => {
    resizeChatInput();
  }, [tweakInput]);

  useEffect(() => {
    void fetch("/api/expo/start", { method: "POST" });
  }, []);

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (initialModel) {
      const audit = auditAppReadiness(initialModel, initialPlan, interview);
      setBubbles([
        {
          id: "welcome-back",
          role: "ai",
          text: `**${initialPlan.appName}** is ready. Use **Brainstorm** for your launch checklist — or **Build** to change the preview.`,
        },
        {
          id: "recap",
          role: "ai",
          text: formatBuildRecap(initialModel, initialPlan, interview),
        },
        {
          id: "readiness-intro",
          role: "ai",
          text: formatReadinessIntro(audit),
          brainstorm: true,
        },
        {
          id: "readiness-list",
          role: "ai",
          text: formatReadinessChecklist(audit),
          brainstorm: true,
        },
        ...brainstormHistoryToBubbles(initialBrainstormState?.history ?? []),
      ]);
      return;
    }

    void prepareExpoBuild(projectId);
    setBubbles([
      {
        id: "intro",
        role: "ai",
        text: `Alright — let's build **${initialPlan.appName}** right here on the web. No download. Here's everything from your plan:`,
      },
      { id: "checklist", role: "ai", text: formatChecklist(initialPlan) },
      {
        id: "confirm-prompt",
        role: "ai",
        text: "Look good? **Confirm** to start building, or **Edit** if you want to tweak anything first.",
      },
    ]);
  }, [projectId, initialPlan, initialModel, interview, initialBrainstormState]);

  function clearBuildTimers() {
    buildTimers.current.forEach(clearInterval);
    buildTimers.current = [];
  }

  async function onConfirm() {
    if (busy) return;
    setBusy(true);
    clearBuildTimers();
    setBubbles((b) => [
      ...b,
      { id: "u-confirm", role: "user", text: "Confirm — build it" },
      {
        id: "ai-go",
        role: "ai",
        text: `On it — building **${plan.appName}** now. Watch the progress below and the phone on the right.`,
      },
    ]);
    setPhase("building");
    setBuildPercent(2);
    serverPercentRef.current = 2;
    let microIdx = 0;
    setStepIdx(0);
    setBuildLabels([microSteps[0]?.label ?? "Starting…"]);

    const poll = () => {
      void fetch(`/api/projects/${projectId}/build-progress`)
        .then((r) => r.json())
        .then((data: { active?: boolean; label?: string; index?: number; percent?: number }) => {
          if (!data.active) return;
          if (typeof data.percent === "number") {
            serverPercentRef.current = Math.max(serverPercentRef.current, data.percent);
          }
        })
        .catch(() => undefined);
    };

    poll();
    pollRef.current = setInterval(poll, 400);
    buildTimers.current.push(pollRef.current);

    const microAdvance = setInterval(() => {
      if (microIdx < microSteps.length - 1) {
        microIdx += 1;
        setStepIdx(microIdx);
        const label = microSteps[microIdx].label;
        setBuildLabels((prev) => (prev.includes(label) ? prev : [...prev, label]));
      }
    }, 3800);
    buildTimers.current.push(microAdvance);

    const smooth = setInterval(() => {
      const microTarget = microSteps[microIdx]?.percent ?? 0;
      const target = Math.max(serverPercentRef.current, microTarget);
      setBuildPercent((p) => {
        if (p >= target) return p;
        return Math.min(target, p + 0.8);
      });
    }, 280);
    buildTimers.current.push(smooth);

    try {
      const result = await runExpoWebBuild(projectId);
      clearBuildTimers();
      serverPercentRef.current = 100;
      setBuildPercent(100);
      setStepIdx(microSteps.length - 1);
      setBuildLabels(microSteps.map((s) => s.label));
      setAppModel(result.model);
      const audit = auditAppReadiness(result.model, plan, interview);
      setBubbles((b) => [
        ...b,
        {
          id: "done",
          role: "ai",
          text: formatBuildRecap(result.model, plan, interview),
        },
        {
          id: "readiness-intro",
          role: "ai",
          text: formatReadinessIntro(audit),
          brainstorm: true,
        },
        {
          id: "readiness-list",
          role: "ai",
          text: formatReadinessChecklist(audit),
          brainstorm: true,
        },
      ]);
      setPhase("done");
      setBudgetKey((k) => k + 1);
    } catch {
      clearBuildTimers();
      setBubbles((b) => [
        ...b,
        { id: "err", role: "ai", text: "Hit a snag — try Confirm again in a sec." },
      ]);
      setPhase("summary");
    } finally {
      clearBuildTimers();
      setBusy(false);
    }
  }

  function onEdit() {
    setEditForm({
      appName: plan.appName,
      description: plan.description,
      audience: plan.audience,
      features: plan.features.join("\n"),
      colors: plan.colors,
    });
    setBubbles((b) => [
      ...b,
      { id: "u-edit", role: "user", text: "Edit my plan" },
      { id: "ai-edit", role: "ai", text: "No problem — tweak anything below, then hit **Save & review**." },
    ]);
    setPhase("edit");
  }

  async function onSaveEdit() {
    if (busy) return;
    setBusy(true);
    const features = editForm.features
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const patch: MasterBuildPrompt = {
      ...plan,
      appName: editForm.appName.trim() || plan.appName,
      description: editForm.description.trim() || plan.description,
      audience: editForm.audience.trim() || plan.audience,
      features: features.length ? features : plan.features,
      colors: editForm.colors.trim() || plan.colors,
    };
    try {
      const next = await updateExpoPlan(projectId, patch);
      setPlan(next);
      setAppModel(null);
      setBubbles((b) => [
        ...b,
        { id: "u-saved", role: "user", text: "Saved my changes" },
        { id: "ai-updated", role: "ai", text: "Updated — here's your plan now:" },
        { id: "checklist2", role: "ai", text: formatChecklist(next) },
        {
          id: "confirm2",
          role: "ai",
          text: "Ready? **Confirm** to build, or **Edit** again.",
        },
      ]);
      setPhase("summary");
    } catch {
      setBubbles((b) => [
        ...b,
        { id: "save-err", role: "ai", text: "Couldn't save — try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const showPreview = phase === "building" || phase === "done" || Boolean(appModel);

  const previewReady = phase === "done" && Boolean(appModel);

  const showFloatingBuild =
    phase === "done" &&
    chatMode === "brainstorm" &&
    Boolean(buildHandoff?.show) &&
    !busy;

  useEffect(() => {
    if (phase === "building" || previewReady) {
      void fetch("/api/expo/start", { method: "POST" });
    }
  }, [phase, previewReady]);

  return (
    <div className={`flex min-h-0 w-full flex-col ${className}`}>
      <div className="grid h-full min-h-0 w-full flex-1 grid-cols-1 xl:grid-cols-[minmax(300px,28vw)_1fr_minmax(300px,24vw)] [&>*]:min-h-0">
      <div className="chat-panel-surface flex min-h-0 flex-col overflow-hidden border-b border-line/30 xl:border-b-0 xl:border-r">
        <div className="relative z-10 flex shrink-0 items-start gap-3 overflow-visible border-b border-line/25 px-4 py-3 pb-4">
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-coral to-coral-deep text-sm font-bold text-white shadow-[0_4px_14px_-2px_rgba(255,122,99,0.5)]">
            A
            <span className="absolute -inset-0.5 -z-10 rounded-xl bg-coral/25 blur-md" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 overflow-visible">
            <p className="font-display text-sm font-semibold tracking-tight text-charcoal">
              Appable
            </p>
            {phase === "done" ? (
              <BuildModeToggle mode={chatMode} onChange={setChatMode} />
            ) : (
              <p className="mt-0.5 text-[11px] leading-snug text-warmgrey">
                Let&apos;s shape <span className="font-medium text-charcoal-soft">{plan.appName}</span>
              </p>
            )}
          </div>
          <AiBudgetBar
            projectId={projectId}
            refreshKey={budgetKey}
            variant="ring"
            className="shrink-0"
          />
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {bubbles.map((b) => (
            <div
              key={b.id}
              className={
                b.role === "ai"
                  ? "chat-bubble-ai max-w-[94%] rounded-2xl rounded-tl-md border border-line/30 bg-white/80 px-4 py-3 text-[13px] leading-relaxed text-charcoal shadow-[0_2px_14px_-6px_rgba(43,38,36,0.1)] backdrop-blur-sm"
                  : "chat-bubble-user ml-auto max-w-[88%] rounded-2xl rounded-tr-md bg-gradient-to-br from-coral via-coral to-[#ff6b54] px-4 py-2.5 text-[13px] leading-relaxed text-white shadow-[0_6px_20px_-6px_rgba(255,122,99,0.55)]"
              }
            >
              <ChecklistText text={b.text} variant={b.role === "user" ? "user" : "ai"} />
            </div>
          ))}
          {phase === "building" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-float space-y-3 p-4"
            >
              <div className="flex items-center justify-between text-xs text-warmgrey">
                <span className="font-medium text-charcoal">Building {plan.appName}</span>
                <span>{Math.round(buildPercent)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-line/80">
                <motion.div
                  className="h-full rounded-full bg-coral"
                  animate={{ width: `${buildPercent}%` }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
              </div>
              <div className="space-y-2">
                {buildLabels.map((label, i) => (
                  <motion.div
                    key={`${label}-${i}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-sm text-charcoal"
                  >
                    <span
                      className={
                        i < buildLabels.length - 1
                          ? "grid h-5 w-5 place-items-center rounded-full bg-moss/15 text-moss"
                          : "grid h-5 w-5 place-items-center rounded-full bg-coral/15 text-coral"
                      }
                    >
                      {i < buildLabels.length - 1 ? (
                        "✓"
                      ) : (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                    </span>
                    {label}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
          {busy && phase !== "building" && <TypingIndicator />}
          <div ref={endRef} className="h-px" />
        </div>

        {phase === "summary" && (
          <div className="flex shrink-0 gap-2 border-t border-line/40 px-4 py-3">
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={busy}
              className="btn-primary inline-flex flex-1 items-center justify-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              Confirm — build it
            </button>
            <button
              type="button"
              onClick={onEdit}
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-charcoal transition hover:border-coral/40"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          </div>
        )}

        {phase === "edit" && (
          <div className="shrink-0 space-y-2 border-t border-line/40 px-4 py-3">
            <EditField
              label="App name"
              value={editForm.appName}
              onChange={(v) => setEditForm((f) => ({ ...f, appName: v }))}
            />
            <EditField
              label="Idea"
              value={editForm.description}
              onChange={(v) => setEditForm((f) => ({ ...f, description: v }))}
              rows={2}
            />
            <EditField
              label="For"
              value={editForm.audience}
              onChange={(v) => setEditForm((f) => ({ ...f, audience: v }))}
            />
            <EditField
              label="Features (one per line)"
              value={editForm.features}
              onChange={(v) => setEditForm((f) => ({ ...f, features: v }))}
              rows={3}
            />
            <EditField
              label="Colors"
              value={editForm.colors}
              onChange={(v) => setEditForm((f) => ({ ...f, colors: v }))}
            />
            <button
              type="button"
              onClick={() => void onSaveEdit()}
              disabled={busy}
              className="btn-primary w-full"
            >
              Save & review
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="shrink-0 border-t border-line/25 bg-white/55 px-4 py-3 backdrop-blur-md">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {chatMode === "build" && (
                <button
                  type="button"
                  onClick={() => {
                    setFixMode((m) => !m);
                    setFixTarget(null);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    fixMode
                      ? "border-coral/50 bg-coral/12 text-coral-deep shadow-[0_0_12px_rgba(255,122,99,0.2)]"
                      : "border-line/50 bg-white/80 text-charcoal-soft hover:border-coral/35"
                  }`}
                >
                  <MousePointer2 className="h-3 w-3" />
                  {fixMode ? "Done selecting" : "Tap to fix"}
                </button>
              )}
            </div>

            <FloatingBuildHandoff
              visible={showFloatingBuild}
              label={buildHandoff?.label ?? "Build it"}
              busy={busy}
              onBuild={() => {
                if (buildHandoff?.prompt) handoffToBuildAndRun(buildHandoff.prompt);
              }}
            />

            {readinessSuggestions.length > 0 && (
              <ReadinessSuggestionBar
                suggestions={readinessSuggestions}
                activeId={highlightedSuggestionId}
                chatMode={chatMode}
                onPick={pickReadinessSuggestion}
                className="mb-2"
              />
            )}

            {chatMode === "brainstorm" && pinnedItem && (
              <div className="mb-2 flex items-center gap-1.5 rounded-full border border-coral/30 bg-coral/8 py-1 pl-2.5 pr-1 text-[10px] font-semibold text-coral-deep">
                <Pin className="h-3 w-3 shrink-0" />
                <span className="min-w-0 truncate">Discussing: {pinnedItem.title}</span>
                <button
                  type="button"
                  onClick={clearPinnedReadiness}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-coral-deep/70 hover:bg-coral/15 hover:text-coral-deep"
                  aria-label="Clear focus"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            <form
              className="flex items-end gap-2 rounded-2xl border border-line/35 bg-white/95 p-1.5 shadow-[0_4px_20px_-8px_rgba(43,38,36,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
              onSubmit={(e) => {
                e.preventDefault();
                if (!tweakInput.trim() || busy || chatSubmittingRef.current) return;
                const msg = tweakInput.trim();
                const pinnedId = readinessState.pinnedItemId;
                setTweakInput("");
                setBusy(true);
                chatSubmittingRef.current = true;

                if (chatMode === "brainstorm") {
                  setBubbles((b) => [
                    ...b.filter((x) => x.id !== "bchat-pending-user"),
                    {
                      id: "bchat-pending-user",
                      role: "user",
                      text: msg,
                      brainstormChat: true,
                    },
                  ]);
                  void expoBrainstormChat(projectId, msg, pinnedId)
                    .then((res) => {
                      if (res.ok) {
                        setBrainstormState(res.brainstormState);
                        setBubbles((b) =>
                          mergeBrainstormBubbles(b, res.brainstormState.history)
                        );
                        if (pinnedId) markPinnedDiscussed(pinnedId);
                      } else {
                        setBubbles((b) => [
                          ...b,
                          {
                            id: `tu-${Date.now()}`,
                            role: "user",
                            text: msg,
                            brainstormChat: true,
                          },
                          {
                            id: `ta-${Date.now()}`,
                            role: "ai",
                            text: res.message,
                            brainstorm: true,
                            brainstormChat: true,
                          },
                        ]);
                      }
                    })
                    .finally(() => {
                      setBusy(false);
                      chatSubmittingRef.current = false;
                    });
                  return;
                }

                submitBuildMessage(msg);
              }}
            >
              <textarea
                ref={chatInputRef}
                value={tweakInput}
                rows={1}
                onChange={(e) => setTweakInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={
                  chatMode === "brainstorm"
                    ? "What should we add next?"
                    : "Describe a change to your app…"
                }
                className="max-h-40 min-h-9 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2.5 py-2 text-sm leading-relaxed text-charcoal outline-none placeholder:text-warmgrey/80"
                disabled={busy}
              />
              <button
                type="submit"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-coral to-[#ff6b54] text-white shadow-[0_4px_14px_-4px_rgba(255,122,99,0.65)] transition hover:brightness-105 disabled:opacity-40"
                disabled={busy || !tweakInput.trim()}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="build-pane-mesh relative flex min-h-0 flex-col items-center justify-center overflow-hidden border-b border-line/30 xl:border-b-0 xl:border-r">
        {showPreview && (
          <div className="absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
            <PreviewCanvasPicker appName={plan.appName} />
          </div>
        )}
        <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 px-6 py-6">
          {showPreview ? (
            <>
              <ExpoLivePreview
                projectId={projectId}
                model={appModel}
                building={phase === "building"}
                buildPercent={buildPercent}
                startPastOnboarding
                alive={phase === "done"}
                editMode={fixMode && phase === "done" && chatMode === "build"}
                selectedPath={fixTarget?.path ?? null}
                onSelectTarget={(t) => setFixTarget(t)}
                showWatermark={showWatermark}
                className="!w-[300px] !max-w-[min(300px,78vw)]"
              />
              {fixTarget && appModel && phase === "done" && (
                <PreviewFixPanel
                  target={fixTarget}
                  currentValue={getStringAtPath(appModel, fixTarget.path)}
                  busy={fixBusy}
                  onClose={() => setFixTarget(null)}
                  onApply={(action: SelectionTweakAction) => {
                    setFixBusy(true);
                    void expoSelectionTweak(projectId, fixTarget.path, action)
                      .then((res) => {
                        setBudgetKey((k) => k + 1);
                        if (res.ok) {
                          setAppModel(res.model);
                          setBubbles((b) => [
                            ...b,
                            { id: `fx-${Date.now()}`, role: "ai", text: res.reply },
                          ]);
                          if (action.type === "remove") setFixTarget(null);
                        } else {
                          setBubbles((b) => [
                            ...b,
                            { id: `fxe-${Date.now()}`, role: "ai", text: res.message },
                          ]);
                        }
                      })
                      .finally(() => setFixBusy(false));
                  }}
                />
              )}
            </>
          ) : (
            <div
              className="rounded-2xl border border-dashed border-line/80 bg-cream/50 p-6 text-center"
              style={{ width: 300, maxWidth: "min(300px, 78vw)", aspectRatio: `${70.6} / ${146.6}` }}
            >
              <Sparkles className="mx-auto h-8 w-8 text-coral/60" />
              <p className="mt-2 text-xs text-warmgrey">
                Your live preview appears here when you confirm
              </p>
            </div>
          )}
        </div>

        <div className="w-full max-w-md px-4 pb-4 xl:hidden">
          <ExpoPhoneGuide
            projectId={projectId}
            previewToken={previewToken}
            appName={plan.appName}
            ready={previewReady}
          />
        </div>
      </div>

      <BuildSidePanel
        projectId={projectId}
        previewToken={previewToken}
        appName={plan.appName}
        previewReady={previewReady}
        readinessAudit={readinessAudit}
        supabaseConnector={supabaseConnector}
        revenueCatConnector={revenueCatConnector}
        railwayConnector={railwayConnector}
        connectorNeeds={connectorNeeds}
        onSupabaseConnectorChange={setSupabaseConnector}
        onRevenueCatConnectorChange={setRevenueCatConnector}
        onRailwayConnectorChange={setRailwayConnector}
        connectorRecommendations={connectorRecommendations}
        chatMode={chatMode}
        onAskAbout={askAboutReadiness}
        onDecision={setReadinessDecision}
      />
      </div>
    </div>
  );
}

function formatChecklist(mp: MasterBuildPrompt): string {
  const lines = planChecklist(mp).map((item) => `✓ **${item.label}:** ${item.value}`);
  return lines.join("\n");
}

function ChecklistText({
  text,
  variant = "ai",
}: {
  text: string;
  variant?: "ai" | "user";
}) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  const strongClass =
    variant === "user" ? "font-semibold text-white" : "font-semibold text-charcoal";
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className={strongClass}>
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

function EditField({
  label,
  value,
  onChange,
  rows = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block text-xs">
      <span className="font-semibold text-warmgrey">{label}</span>
      {rows > 1 ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral/50"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral/50"
        />
      )}
    </label>
  );
}
