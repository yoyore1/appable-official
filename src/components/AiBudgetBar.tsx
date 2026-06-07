"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { PublicAiUsage } from "@/lib/aiUsage";

export function AiBudgetBar({
  projectId,
  className = "",
  refreshKey,
}: {
  projectId?: string;
  className?: string;
  /** Bump after server actions that spend AI budget. */
  refreshKey?: number;
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

  if (!usage) {
    return (
      <div
        className={`flex items-center gap-2 rounded-xl border border-line/60 bg-white/80 px-3 py-1.5 text-xs backdrop-blur-sm ${className}`}
        aria-busy="true"
        aria-label="Loading AI power"
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

  const pct = usage.remainingPercent;
  const low = pct <= 20;

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
