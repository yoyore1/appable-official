"use client";

import { ArrowRight, Hammer } from "lucide-react";
import type { BrainstormBuildSuggestion } from "@/lib/types";

export function BrainstormBuildHandoff({
  suggestion,
  busy,
  onBuild,
}: {
  suggestion: BrainstormBuildSuggestion;
  busy?: boolean;
  onBuild: () => void;
}) {
  return (
    <div className="mb-2 rounded-xl border border-coral/30 bg-gradient-to-br from-coral/[0.08] to-peach/15 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-coral-deep">
        Ready to build
      </p>
      <p className="mt-1 text-xs leading-snug text-charcoal">{suggestion.prompt}</p>
      <button
        type="button"
        disabled={busy}
        onClick={onBuild}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-charcoal px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-charcoal/90 disabled:opacity-50"
      >
        <Hammer className="h-3.5 w-3.5" />
        {suggestion.label}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
