"use client";

import type { ReadinessSuggestion } from "@/lib/expoApp/readinessAudit";
import { cn } from "@/lib/utils";

export function ReadinessSuggestionBar({
  suggestions,
  activeId,
  chatMode = "brainstorm",
  onPick,
  className,
}: {
  suggestions: ReadinessSuggestion[];
  activeId?: string | null;
  chatMode?: "brainstorm" | "build";
  onPick: (suggestion: ReadinessSuggestion) => void;
  className?: string;
}) {
  const highlightedId = activeId ?? suggestions[0]?.id ?? null;
  if (suggestions.length === 0) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-warmgrey">
        What to do next
      </p>
      <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:flex-wrap">
        {suggestions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s)}
            className={cn(
              "pill w-full text-left !py-2 !text-xs shadow-soft sm:w-auto sm:max-w-full",
              s.id === highlightedId && "pill-accent"
            )}
          >
            <span className="font-bold text-coral-deep">{s.step}.</span> {s.label}
          </button>
        ))}
      </div>
      <p className="text-[9px] text-warmgrey">
        {chatMode === "build"
          ? "Tap one — then press Enter to update your preview."
          : "Tap one — then press Enter to send."}
      </p>
    </div>
  );
}
