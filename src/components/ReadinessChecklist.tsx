"use client";

import { useMemo } from "react";
import { Check, Pin } from "lucide-react";
import type {
  AppReadinessAudit,
  ReadinessDecision,
  ReadinessItem,
  ReadinessStatus,
} from "@/lib/expoApp/readinessAudit";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<ReadinessStatus, { dot: string; label: string }> = {
  have: { dot: "bg-moss", label: "Ready" },
  partial: { dot: "bg-amber-400", label: "Preview only" },
  missing: { dot: "bg-line", label: "To plan" },
};

const DECISION_LABEL: Record<ReadinessDecision, string> = {
  yes: "Need this",
  later: "Later",
  skip: "Skip",
};

function DecisionChip({ decision }: { decision: ReadinessDecision }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide",
        decision === "yes" && "bg-moss/15 text-moss",
        decision === "later" && "bg-amber-100 text-amber-800",
        decision === "skip" && "bg-sand text-warmgrey"
      )}
    >
      {DECISION_LABEL[decision]}
    </span>
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
  const st = STATUS_STYLES[item.status];
  const discussed = item.userState?.discussed;
  const decision = item.userState?.decision;

  return (
    <div
      className={cn(
        "rounded-xl border px-2 py-2 transition",
        item.pinned
          ? "border-coral/45 bg-coral/[0.06] ring-1 ring-coral/25"
          : "border-transparent hover:border-line/50 hover:bg-white/80"
      )}
    >
      <button
        type="button"
        onClick={() => onAsk?.(item)}
        className="flex w-full items-start gap-2 text-left"
      >
        <span
          className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", st.dot)}
          title={st.label}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] font-semibold text-charcoal">{item.title}</span>
            {item.pinned && (
              <Pin className="h-2.5 w-2.5 text-coral" aria-label="Pinned in chat" />
            )}
            {discussed && !decision && (
              <Check className="h-2.5 w-2.5 text-moss" aria-label="Discussed" />
            )}
            {decision && <DecisionChip decision={decision} />}
          </span>
          <span className="mt-0.5 block text-[10px] leading-snug text-warmgrey">{item.plainWhy}</span>
        </span>
      </button>

      {onDecision && item.status !== "have" && (
        <div className="mt-1.5 flex flex-wrap gap-1 pl-4">
          {(["yes", "later", "skip"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDecision(item, d)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[9px] font-semibold transition",
                decision === d
                  ? "border-coral/40 bg-coral/10 text-coral-deep"
                  : "border-line/40 bg-white/60 text-warmgrey hover:border-line hover:text-charcoal"
              )}
            >
              {DECISION_LABEL[d]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReadinessChecklist({
  audit,
  chatMode = "brainstorm",
  onAskAbout,
  onDecision,
  className,
}: {
  audit: AppReadinessAudit;
  chatMode?: "brainstorm" | "build";
  onAskAbout?: (item: ReadinessItem) => void;
  onDecision?: (item: ReadinessItem, decision: ReadinessDecision) => void;
  className?: string;
}) {
  const { blockers, rest } = useMemo(() => {
    const blockers = audit.items.filter(
      (i) => i.priority === "launch_blocker" && i.status !== "have"
    );
    const rest = audit.items.filter(
      (i) => !(i.priority === "launch_blocker" && i.status !== "have")
    );
    return { blockers, rest };
  }, [audit.items]);

  return (
    <div
      className={cn(
        "rounded-2xl border border-line/35 bg-white/85 p-3 shadow-[0_4px_20px_-10px_rgba(43,38,36,0.12)] backdrop-blur-sm",
        className
      )}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold text-charcoal">Launch checklist</p>
        <p className="text-[10px] text-warmgrey">
          {audit.discussedCount} discussed · {audit.missingCount} to plan
        </p>
      </div>

      {blockers.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-wide text-coral-deep">
            Before you ship
          </p>
          <div className="space-y-1">
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
          <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-wide text-warmgrey">
            Also worth planning
          </p>
          <div className="space-y-1">
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
        <p className="mt-2 px-2 text-[9px] text-warmgrey">
          {chatMode === "build"
            ? "Tap to fix anything in the preview — or switch to Brainstorm to ask about any line."
            : "Ask me about any line — or switch to Build to change the preview."}
        </p>
      )}
    </div>
  );
}
