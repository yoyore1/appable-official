"use client";

import { Hammer, MessageCircle, Sparkles } from "lucide-react";
import type { InsightSuggestion } from "@/lib/insights/types";
import { cn } from "@/lib/utils";

export function InsightSuggestionBar({
  suggestions,
  stageLabel,
  mode,
  onAsk,
  onBuild,
  className,
}: {
  suggestions: InsightSuggestion[];
  stageLabel: string;
  mode: "explore" | "insights";
  onAsk: (suggestion: InsightSuggestion) => void;
  onBuild: (suggestion: InsightSuggestion) => void;
  className?: string;
}) {
  if (!suggestions.length) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-warmgrey">
        <Sparkles className="h-3 w-3 text-coral" />
        {mode === "explore" ? "Explore integrations" : "From your data"} · {stageLabel}
      </p>
      <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:flex-wrap">
        {suggestions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => (s.kind === "build" ? onBuild(s) : onAsk(s))}
            className={cn(
              "pill w-full text-left !py-2 !text-xs shadow-soft sm:w-auto sm:max-w-full",
              s.kind === "build" && "border-coral/35 bg-coral/8"
            )}
          >
            <span className="inline-flex items-center gap-1">
              {s.kind === "build" ? (
                <Hammer className="h-3 w-3 shrink-0 text-coral-deep" />
              ) : (
                <MessageCircle className="h-3 w-3 shrink-0 text-warmgrey" />
              )}
              {s.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
