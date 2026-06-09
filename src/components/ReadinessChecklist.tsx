"use client";

import { useMemo, type ReactNode } from "react";
import { Check, Clock, Pin, Star, X } from "lucide-react";
import type {
  AppReadinessAudit,
  ReadinessDecision,
  ReadinessItem,
  ReadinessStatus,
} from "@/lib/expoApp/readinessAudit";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<ReadinessStatus, { icon: string; label: string }> = {
  have: { icon: "bg-moss/10 text-moss ring-moss/20", label: "Ready" },
  partial: { icon: "bg-amber-50 text-amber-600 ring-amber-200/50", label: "Preview only" },
  missing: { icon: "bg-line/40 text-warmgrey ring-line/50", label: "To plan" },
};

const DECISION_OPTIONS = ["done", "yes", "later", "skip"] as const;

const DECISION_LABEL: Record<ReadinessDecision, string> = {
  done: "Done",
  yes: "Need this",
  later: "Later",
  skip: "Skip",
};

const DECISION_BADGE: Record<ReadinessDecision, string> = {
  done: "bg-moss/12 text-moss",
  yes: "bg-violet-100 text-violet-700",
  later: "bg-amber-100 text-amber-800",
  skip: "bg-red-100 text-red-700",
};

const DECISION_BUTTON_SELECTED: Record<ReadinessDecision, string> = {
  done: "border-moss/45 bg-moss/10 text-moss shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
  yes: "border-violet-300/60 bg-violet-50 text-violet-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
  later: "border-amber-300/60 bg-amber-50 text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
  skip: "border-red-300/60 bg-red-50 text-red-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]",
};

const DECISION_ICON: Record<ReadinessDecision, string> = {
  done: "bg-moss text-white ring-moss/30",
  yes: "bg-violet-500 text-white ring-violet-300/40",
  later: "bg-amber-600 text-white ring-amber-300/40",
  skip: "bg-red-600 text-white ring-red-300/40",
};

function StatusIcon({
  decision,
  status,
}: {
  decision?: ReadinessDecision | null;
  status: ReadinessStatus;
}) {
  const st = STATUS_STYLES[status];

  return (
    <span
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-xl ring-1",
        decision ? DECISION_ICON[decision] : st.icon
      )}
      title={decision ? DECISION_LABEL[decision] : st.label}
      aria-hidden
    >
      {decision === "done" && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
      {decision === "yes" && (
        <Star className="h-3.5 w-3.5 fill-current" strokeWidth={2} />
      )}
      {decision === "later" && <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />}
      {decision === "skip" && <X className="h-3.5 w-3.5" strokeWidth={2.5} />}
      {!decision && (
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            status === "have" && "bg-moss",
            status === "partial" && "bg-amber-400",
            status === "missing" && "bg-warmgrey/50"
          )}
        />
      )}
    </span>
  );
}

function DecisionBadge({ decision }: { decision: ReadinessDecision }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide",
        DECISION_BADGE[decision]
      )}
    >
      {DECISION_LABEL[decision]}
    </span>
  );
}

function decisionButtonClass(decision: ReadinessDecision, selected: boolean) {
  if (!selected) {
    return "border-line/40 bg-white/90 text-warmgrey hover:border-line/60 hover:bg-sand/40 hover:text-charcoal";
  }
  return DECISION_BUTTON_SELECTED[decision];
}

function SectionLabel({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-0.5">
      <p
        className={cn(
          "shrink-0 text-[9px] font-bold uppercase tracking-wider",
          accent ? "text-coral-deep" : "text-warmgrey"
        )}
      >
        {children}
      </p>
      <div className="h-px min-w-0 flex-1 bg-line/35" />
    </div>
  );
}

function Row({
  item,
  onAsk,
  onDecision,
}: {
  item: ReadinessItem;
  onAsk?: (item: ReadinessItem) => void;
  onDecision?: (item: ReadinessItem, decision: ReadinessDecision) => void;
}) {
  const discussed = item.userState?.discussed;
  const decision = item.userState?.decision;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-white/80 shadow-sm transition",
        item.pinned
          ? "border-coral/25 bg-gradient-to-br from-coral/[0.06] via-white to-white shadow-[0_4px_16px_-8px_rgba(255,122,99,0.12)]"
          : "border-line/35 hover:border-line/50 hover:shadow-[0_4px_14px_-8px_rgba(43,38,36,0.1)]"
      )}
    >
      {item.pinned && (
        <span className="absolute inset-y-0 left-0 w-[3px] bg-coral" aria-hidden />
      )}

      <div className="p-3">
        <button
          type="button"
          onClick={() => onAsk?.(item)}
          className={cn("flex w-full items-start gap-3 text-left", item.pinned && "pl-1")}
        >
          <StatusIcon decision={decision} status={item.status} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold tracking-tight text-charcoal">
                {item.title}
              </span>
              {item.pinned && (
                <Pin className="h-3 w-3 text-coral" aria-label="Pinned in chat" />
              )}
              {discussed && !decision && (
                <Check className="h-3 w-3 text-moss" aria-label="Discussed" />
              )}
              {decision && <DecisionBadge decision={decision} />}
            </span>
            <span className="mt-1 block text-[10px] leading-relaxed text-warmgrey">
              {item.plainWhy}
            </span>
          </span>
        </button>

        {onDecision && (
          <div className="mt-2.5 flex flex-wrap gap-1.5 pl-11">
            {DECISION_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onDecision(item, d)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition",
                  decisionButtonClass(d, decision === d)
                )}
              >
                {d === "done" && <Check className="h-3 w-3" aria-hidden />}
                {d === "yes" && <Star className="h-3 w-3" aria-hidden />}
                {d === "later" && <Clock className="h-3 w-3" aria-hidden />}
                {d === "skip" && <X className="h-3 w-3" aria-hidden />}
                {DECISION_LABEL[d]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ReadinessChecklist({
  audit,
  chatMode = "brainstorm",
  onAskAbout,
  onDecision,
  embedded = false,
  className,
}: {
  audit: AppReadinessAudit;
  chatMode?: "brainstorm" | "build";
  onAskAbout?: (item: ReadinessItem) => void;
  onDecision?: (item: ReadinessItem, decision: ReadinessDecision) => void;
  /** Flat list inside a collapsible panel — no outer card chrome. */
  embedded?: boolean;
  className?: string;
}) {
  const { blockers, rest } = useMemo(() => {
    const blockers = audit.items.filter((i) => i.priority === "launch_blocker");
    const rest = audit.items.filter((i) => i.priority !== "launch_blocker");
    return { blockers, rest };
  }, [audit.items]);

  return (
    <div
      className={cn(
        embedded ? "min-h-0 space-y-4" : "rounded-2xl border border-line/25 bg-gradient-to-br from-white to-sand/30 p-4 shadow-[0_2px_12px_-6px_rgba(43,38,36,0.08)]",
        className
      )}
    >
      {!embedded && (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <p className="text-[13px] font-semibold tracking-tight text-charcoal">
            Launch checklist
          </p>
          <p className="text-[10px] text-warmgrey">
            {audit.discussedCount} discussed · {audit.missingCount} to plan
          </p>
        </div>
      )}

      {blockers.length > 0 && (
        <div>
          <SectionLabel accent>Before you ship</SectionLabel>
          <div className="space-y-2">
            {blockers.map((item) => (
              <Row
                key={item.id}
                item={item}
                onAsk={onAskAbout}
                onDecision={onDecision}
              />
            ))}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div>
          <SectionLabel>Also worth planning</SectionLabel>
          <div className="space-y-2">
            {rest.map((item) => (
              <Row
                key={item.id}
                item={item}
                onAsk={onAskAbout}
                onDecision={onDecision}
              />
            ))}
          </div>
        </div>
      )}

      {onAskAbout && (
        <p className="rounded-xl border border-line/25 bg-white/60 px-3 py-2.5 text-[10px] leading-relaxed text-warmgrey">
          {chatMode === "build"
            ? "Tap a line to fix it in the preview, or switch to Brainstorm to talk it through."
            : "Tap a line to ask about it, or switch to Build to change the preview."}
        </p>
      )}
    </div>
  );
}
