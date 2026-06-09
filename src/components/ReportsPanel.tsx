"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  CalendarClock,
  AlertTriangle,
  BarChart3,
  Check,
  Loader2,
  RefreshCw,
  Rocket,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { InsightSuggestionBar } from "@/components/InsightSuggestionBar";
import { getConnectorDefinition } from "@/lib/connectors/registry";
import { compareWeekOverWeek } from "@/lib/insights/buildHandoff";
import { INSIGHTS_ONBOARDING, onboardingProgress } from "@/lib/insights/onboarding";
import { privacyChecklistForProject } from "@/lib/insights/privacy";
import { resolveInsightsDataStage, stageLabel } from "@/lib/insights/modes";
import {
  canRunWeeklyReports,
  daysUntilFirstReport,
  reportsPanelSubtitle,
  reportsPhaseMessage,
  resolveReportsPhase,
} from "@/lib/insights/reportsLifecycle";
import { stagingFilterHint } from "@/lib/insights/staging";
import {
  defaultInsightsState,
  type InsightSuggestion,
  type IntegrationInsightSnapshot,
  type ProjectInsightsState,
} from "@/lib/insights/types";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

async function insightsRequest(
  projectId: string,
  body: Record<string, unknown>
): Promise<
  | { ok: true; state: ProjectInsightsState }
  | { ok: false; message: string }
> {
  try {
    const res = await fetch(`/api/projects/${projectId}/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as {
      state?: ProjectInsightsState;
      error?: string;
      message?: string;
    } | null;

    if (!res.ok || !data?.state) {
      const message =
        typeof data?.message === "string"
          ? data.message
          : data?.error === "unauthorized"
            ? "Please sign in again."
            : data?.error === "not_found"
              ? "Project not found."
              : data?.error === "reports_not_ready"
                ? "Reports are not ready yet."
                : typeof data?.error === "string"
                  ? data.error
                  : "Could not load reports. Try again.";
      return { ok: false, message };
    }

    return { ok: true, state: data.state };
  } catch {
    return { ok: false, message: "Could not load reports. Check your connection." };
  }
}

function SectionDivider({ label, trailing }: { label: string; trailing?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <p className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-charcoal-soft">
        {label}
      </p>
      {trailing && (
        <span className="shrink-0 text-[11px] font-semibold text-coral-deep">{trailing}</span>
      )}
      <div className="h-px min-w-0 flex-1 bg-line/40" />
    </div>
  );
}

function MiniBarChart({ bars }: { bars: NonNullable<IntegrationInsightSnapshot["chartBars"]> }) {
  const max = Math.max(...bars.map((b) => b.max ?? b.value), 1);
  return (
    <div className="mt-3 space-y-2">
      {bars.map((bar) => (
        <div key={bar.label} className="flex items-center gap-2 text-[11px]">
          <span className="w-24 shrink-0 truncate font-medium text-charcoal-soft">
            {bar.label}
          </span>
          <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-sand/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-coral/80 to-coral"
              style={{ width: `${Math.min(100, (bar.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right font-bold text-charcoal">{bar.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatusCard({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line/35 bg-white/85 p-4 text-center shadow-sm">
      <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-coral/10 text-coral ring-1 ring-coral/20">
        {icon}
      </span>
      <p className="mt-3 text-[13px] font-bold tracking-tight text-charcoal">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-[11px] leading-relaxed text-charcoal-soft">
        {body}
      </p>
      {action}
    </div>
  );
}

function healthBadge(health: IntegrationInsightSnapshot["health"]) {
  switch (health) {
    case "ok":
      return "text-emerald-700 bg-emerald-50 border-emerald-200/60";
    case "no_data":
      return "text-amber-800 bg-amber-50 border-amber-200/60";
    case "error":
      return "text-red-700 bg-red-50 border-red-200/60";
    default:
      return "text-warmgrey bg-sand/60 border-line/40";
  }
}

/** Founder insights — weekly integration reports + suggestions. */
export function ReportsPanel({
  open,
  onClose,
  appName,
  projectId,
  projectSlice,
  initialState,
  onInsightAsk,
  onInsightBuild,
  onStateChange,
}: {
  open: boolean;
  onClose: () => void;
  appName: string;
  projectId: string;
  projectSlice: Pick<
    Project,
    | "masterPrompt"
    | "expoAppModel"
    | "supabaseConnector"
    | "revenueCatConnector"
    | "railwayConnector"
    | "sdkConnectors"
    | "marketplaceSelections"
  >;
  initialState?: ProjectInsightsState | null;
  onInsightAsk?: (prompt: string) => void;
  onInsightBuild?: (prompt: string, suggestionId: string) => void;
  onStateChange?: (state: ProjectInsightsState) => void;
}) {
  const [state, setState] = useState<ProjectInsightsState>(
    () => initialState ?? defaultInsightsState()
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bundle = state.latestWeekly;
  const snapshots = bundle?.snapshots ?? [];
  const projectForStage = { ...projectSlice, insightsState: state } as Project;
  const reportsPhase = resolveReportsPhase(projectForStage);
  const canPull = canRunWeeklyReports(projectForStage);
  const stage = resolveInsightsDataStage(projectForStage, snapshots);
  const mode: "explore" | "insights" =
    stage === "explore" || stage === "waiting" ? "explore" : "insights";

  const allSuggestions = snapshots.flatMap((s) => s.suggestions).slice(0, 5);
  const privacyItems = privacyChecklistForProject(projectForStage);
  const env = state.analyticsEnvironment;

  const refreshWeekly = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await insightsRequest(projectId, { action: "weekly" });
      if (res.ok) {
        setState(res.state);
        onStateChange?.(res.state);
      } else {
        setError(res.message);
      }
    } catch {
      setError("Could not load reports. Try again.");
    } finally {
      setBusy(false);
    }
  }, [projectId, onStateChange]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initialState) setState(initialState);
    // Only auto-run after submit + 7 day warmup, and only if no report saved yet.
    if (!bundle && !busy && canRunWeeklyReports({ ...projectSlice, insightsState: state } as Project)) {
      void refreshWeekly();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function markAppSubmitted() {
    const res = await insightsRequest(projectId, {
      action: "patch",
      patch: { appSubmittedAt: new Date().toISOString() },
    });
    if (res.ok) {
      setState(res.state);
      onStateChange?.(res.state);
    }
  }

  function pickSuggestion(s: InsightSuggestion) {
    if (s.kind === "build" && onInsightBuild) {
      onInsightBuild(s.buildPrompt ?? s.prompt, s.id);
      onClose();
      return;
    }
    onInsightAsk?.(s.prompt);
    onClose();
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-end justify-center bg-charcoal/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 28, stiffness: 360 }}
            role="dialog"
            aria-modal
            aria-labelledby="reports-panel-title"
            className="relative flex max-h-[min(88dvh,680px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line/40 bg-cream shadow-[0_24px_60px_-20px_rgba(43,38,36,0.35)] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-line/25 bg-gradient-to-br from-white/80 to-sand/20 px-5 py-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-coral/10 text-coral ring-1 ring-coral/20">
                    <BarChart3 className="h-4 w-4" />
                  </span>
                  <div>
                    <h2
                      id="reports-panel-title"
                      className="text-[15px] font-bold tracking-tight text-charcoal"
                    >
                      Reports
                    </h2>
                    <p className="mt-0.5 text-[11px] font-medium text-charcoal-soft">
                      {appName} · {reportsPanelSubtitle(projectForStage, snapshots)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {canPull && (
                  <button
                    type="button"
                    onClick={() => void refreshWeekly()}
                    disabled={busy}
                    className="grid h-8 w-8 place-items-center rounded-lg text-warmgrey hover:bg-sand/80 hover:text-charcoal disabled:opacity-40"
                    aria-label="Refresh reports"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-warmgrey hover:bg-sand/80 hover:text-charcoal"
                  aria-label="Close reports"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200/60 bg-red-50 px-3.5 py-2.5 text-[11px] font-medium leading-relaxed text-red-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {!state.onboardingDone && state.onboardingStep < 4 && (
                <div className="mb-4 rounded-xl border border-line/35 bg-white/85 p-4 shadow-sm">
                  <SectionDivider
                    label="How this works"
                    trailing={`${onboardingProgress(state.onboardingStep)}%`}
                  />
                  <div className="mb-4 h-2 overflow-hidden rounded-full bg-sand/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-coral/90 to-coral"
                      style={{ width: `${onboardingProgress(state.onboardingStep)}%` }}
                    />
                  </div>
                  <ol className="space-y-3">
                    {INSIGHTS_ONBOARDING.map((step) => {
                      const done = step.id < state.onboardingStep;
                      const current = step.id === state.onboardingStep;
                      return (
                        <li
                          key={step.id}
                          className={cn(
                            "flex gap-3 rounded-lg px-1 py-0.5",
                            current && "bg-coral/[0.04]"
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[10px] font-bold ring-1",
                              done
                                ? "bg-moss/12 text-moss ring-moss/25"
                                : current
                                  ? "bg-coral/12 text-coral-deep ring-coral/25"
                                  : "bg-sand/60 text-warmgrey ring-line/40"
                            )}
                          >
                            {done ? <Check className="h-3 w-3" strokeWidth={2.5} /> : step.id + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block text-[12px] font-bold tracking-tight",
                                done || current ? "text-charcoal" : "text-charcoal-soft"
                              )}
                            >
                              {step.title}
                            </span>
                            <span
                              className={cn(
                                "mt-1 block text-[11px] leading-relaxed",
                                done || current ? "text-charcoal-soft" : "text-warmgrey"
                              )}
                            >
                              {step.detail}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {privacyItems.length > 0 && !state.privacyAcknowledgedAt && (
                <div className="mb-4 rounded-xl border border-amber-200/60 bg-amber-50/90 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-[12px] font-bold text-amber-950">
                    <Shield className="h-4 w-4" />
                    Privacy before analytics
                  </div>
                  <ul className="mt-2.5 space-y-1.5 text-[11px] font-medium leading-relaxed text-amber-950/90">
                    {privacyItems.map((item) => (
                      <li key={item.id}>• {item.title}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="mt-3 text-[11px] font-semibold text-amber-950 underline underline-offset-2"
                    onClick={() => {
                      void insightsRequest(projectId, {
                        action: "patch",
                        patch: { privacyAcknowledgedAt: new Date().toISOString() },
                      }).then((res) => {
                        if (res.ok) {
                          setState(res.state);
                          onStateChange?.(res.state);
                        }
                      });
                    }}
                  >
                    I&apos;ll handle these before launch
                  </button>
                </div>
              )}

              {reportsPhase === "active" && (
                <p className="mb-4 rounded-xl border border-line/25 bg-white/60 px-3 py-2.5 text-[11px] leading-relaxed text-charcoal-soft">
                  {stagingFilterHint(env)}
                </p>
              )}

              {bundle ? (
                <>
                  <div className="rounded-xl border border-line/35 bg-white/90 px-4 py-3.5 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-charcoal-soft">
                      Week ending {bundle.weekEnding}
                    </p>
                    <p className="mt-1.5 text-[15px] font-bold tracking-tight text-charcoal">
                      {bundle.overallHeadline}
                    </p>
                  </div>

                  <div className="mt-4 space-y-3">
                    {snapshots.map((snap) => {
                      const def = getConnectorDefinition(snap.connectorId);
                      const priorWeek = state.weeklyHistory?.[1]?.snapshots.find(
                        (p) => p.connectorId === snap.connectorId
                      );
                      const wow = compareWeekOverWeek(snap, priorWeek);
                      return (
                        <div
                          key={snap.connectorId}
                          className="rounded-xl border border-line/35 bg-white/85 px-4 py-3.5 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[13px] font-bold tracking-tight text-charcoal">
                              {def.displayName}
                            </span>
                            <span
                              className={cn(
                                "rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                                healthBadge(snap.health)
                              )}
                            >
                              {snap.health.replace("_", " ")}
                            </span>
                          </div>
                          <p className="mt-1.5 text-[12px] font-semibold text-charcoal">
                            {snap.headline}
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-charcoal-soft">
                            {snap.summary}
                          </p>
                          {wow && (
                            <p className="mt-1 text-[10px] font-semibold text-coral-deep">
                              {wow}
                            </p>
                          )}
                          {snap.limitWarning && (
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-800">
                              <AlertTriangle className="h-3 w-3" />
                              {snap.limitWarning}
                            </p>
                          )}
                          {snap.errorMessage && (
                            <p className="mt-1 text-[10px] text-red-700">{snap.errorMessage}</p>
                          )}
                          {snap.chartBars && snap.chartBars.length > 0 && (
                            <MiniBarChart bars={snap.chartBars} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {allSuggestions.length > 0 && (
                    <div className="mt-4 rounded-xl border border-line/25 bg-white/70 p-3">
                      <InsightSuggestionBar
                        suggestions={allSuggestions}
                        stageLabel={stageLabel(stage)}
                        mode={mode}
                        onAsk={(s) => pickSuggestion(s)}
                        onBuild={(s) => pickSuggestion(s)}
                      />
                    </div>
                  )}
                </>
              ) : reportsPhase === "pre_launch" ? (
                <StatusCard
                  icon={<Rocket className="h-5 w-5" />}
                  title="Reports start after you ship"
                  body="Connect tools in Integrations now if you want. We will not pull data until you submit to TestFlight or the app stores, then wait one week for real users."
                  action={
                    <button
                      type="button"
                      onClick={() => void markAppSubmitted()}
                      className="mt-4 w-full rounded-xl bg-charcoal px-4 py-3 text-[11px] font-semibold text-white shadow-[0_4px_14px_-6px_rgba(43,38,36,0.45)] transition hover:brightness-110"
                    >
                      I submitted to TestFlight or the stores
                    </button>
                  }
                />
              ) : reportsPhase === "warming_up" ? (
                <StatusCard
                  icon={<CalendarClock className="h-5 w-5" />}
                  title={
                    daysUntilFirstReport(projectForStage) === 1
                      ? "First report tomorrow"
                      : `First report in ${daysUntilFirstReport(projectForStage)} days`
                  }
                  body={`${reportsPhaseMessage(projectForStage)} No loading or API calls until then.`}
                />
              ) : (
                <StatusCard
                  icon={
                    busy ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Sparkles className="h-5 w-5" />
                    )
                  }
                  title={
                    busy ? "Building your weekly report…" : "Ready for your first report"
                  }
                  body={
                    busy
                      ? "Pulling numbers from your connected tools. This usually takes a moment."
                      : "Real users should be on your app now. Tap below to pull this week's numbers from your connected tools."
                  }
                  action={
                    !busy ? (
                      <button
                        type="button"
                        onClick={() => void refreshWeekly()}
                        className="mt-4 w-full rounded-xl bg-charcoal px-4 py-3 text-[11px] font-semibold text-white shadow-[0_4px_14px_-6px_rgba(43,38,36,0.45)] transition hover:brightness-110"
                      >
                        Run first report
                      </button>
                    ) : undefined
                  }
                />
              )}
            </div>

            <div className="border-t border-line/25 bg-white/40 px-5 py-3.5">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-line/40 bg-white py-3 text-[11px] font-semibold text-charcoal shadow-sm transition hover:bg-sand/40"
              >
                Back to preview
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
