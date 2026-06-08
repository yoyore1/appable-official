"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { PublicAiUsage } from "@/lib/aiUsage";

function BudgetRing({ pct, low, loading }: { pct: number; low: boolean; loading?: boolean }) {
  const size = 38;
  const stroke = 2.5;
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  const gradId = "appable-budget-ring";

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      title={`${pct}% AI power left`}
      aria-label={`${pct}% AI power left`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={low ? "#f59e0b" : "#ff7a63"} />
            <stop offset="100%" stopColor={low ? "#fbbf24" : "#ffb89a"} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(var(--line) / 0.55)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={loading ? c * 0.7 : offset}
          className={loading ? "animate-pulse" : "transition-[stroke-dashoffset] duration-500"}
        />
      </svg>
      <span
        className={`absolute inset-0 grid place-items-center text-[9px] font-bold tabular-nums ${
          low ? "text-amber-700" : "text-charcoal"
        }`}
      >
        {loading ? "…" : pct}
      </span>
    </div>
  );
}

export function AiBudgetBar({
  projectId,
  className = "",
  refreshKey,
  variant = "bar",
}: {
  projectId?: string;
  className?: string;
  refreshKey?: number;
  variant?: "bar" | "pill" | "ring";
}) {
  const [usage, setUsage] = useState<PublicAiUsage | null>(null);

  const load = useCallback(async () => {
    try {
      const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
      const res = await fetch(`/api/ai/budget${q}`);
      if (!res.ok) return;
      setUsage((await res.json()) as PublicAiUsage);
    } catch {
      /* ignore */
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const pct = usage?.atCap ? 0 : (usage?.remainingPercent ?? 0);
  const low = usage != null && pct <= 20;

  if (variant === "ring") {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <BudgetRing pct={pct} low={low} loading={!usage} />
        <span className="hidden text-[10px] font-medium text-warmgrey sm:inline">
          {usage ? `${pct}% left` : "…"}
        </span>
      </div>
    );
  }

  if (variant === "pill") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-line/50 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-charcoal-soft backdrop-blur-sm ${className}`}
        title="AI power remaining on your free allowance"
      >
        <Sparkles
          className={`h-3 w-3 shrink-0 ${low ? "text-amber-600" : "text-coral"} ${!usage ? "animate-pulse opacity-60" : ""}`}
        />
        {usage ? (
          <span className={low ? "font-semibold text-amber-700" : undefined}>
            {usage.atCap ? "0%" : `${pct}%`} left
          </span>
        ) : (
          <span className="text-warmgrey">…</span>
        )}
      </span>
    );
  }

  if (!usage) {
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border border-line/60 bg-white/80 px-3 py-1.5 text-xs backdrop-blur-sm ${className}`}
        aria-busy="true"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 animate-pulse text-coral/60" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-charcoal">AI power</span>
            <span className="text-warmgrey">…</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-line/70">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-coral/40" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-line/60 bg-white/80 px-3 py-1.5 text-xs backdrop-blur-sm ${className}`}
      title="AI power remaining on your free allowance"
    >
      <Sparkles className={`h-3.5 w-3.5 shrink-0 ${low ? "text-amber-600" : "text-coral"}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-charcoal">AI power</span>
          <span className={low ? "font-semibold text-amber-700" : "text-warmgrey"}>
            {usage.atCap ? "0%" : `${pct}%`} left
          </span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-line/70">
          <div
            className={`h-full rounded-full transition-all ${low ? "bg-amber-500" : "bg-coral"}`}
            style={{ width: `${Math.max(0, pct)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
