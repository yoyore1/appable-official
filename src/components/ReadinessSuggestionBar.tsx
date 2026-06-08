"use client";

import type { ReadinessSuggestion } from "@/lib/expoApp/readinessAudit";
import { cn } from "@/lib/utils";

export function ReadinessSuggestionBar({
  suggestions,
  onPick,
  className,
}: {
  suggestions: ReadinessSuggestion[];
  onPick: (suggestion: ReadinessSuggestion) => void;
  className?: string;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-warmgrey">
        What to do next
      </p>
      <div className="flex w-full flex-col gap-1.5 sm:flex-row sm:flex-wrap">
        {suggestions.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s)}
            className={cn(
              "pill w-full text-left !py-2 !text-xs shadow-soft sm:w-auto sm:max-w-full",
              i === 0 && "pill-accent"
            )}
          >
            <span className="font-bold text-coral-deep">{s.step}.</span> {s.label}
          </button>
        ))}
      </div>
      <p className="text-[9px] text-warmgrey">Tap one — then press Enter to send.</p>
    </div>
  );
}
