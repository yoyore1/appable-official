"use client";

import { Sparkles } from "lucide-react";
import { getConnectorDefinition, type ConnectorRecommendation } from "@/lib/connectors/registry";

/** Optional suggestions — never requirements. */
export function ConnectorRecommendations({
  recommendations,
  onBrowse,
}: {
  recommendations: ConnectorRecommendation[];
  onBrowse?: () => void;
}) {
  if (recommendations.length === 0) return null;

  const next = recommendations[0];

  return (
    <div className="rounded-2xl border border-line/25 bg-gradient-to-br from-white to-sand/40 p-3 shadow-[0_2px_12px_-6px_rgba(43,38,36,0.08)]">
      <div className="flex items-start gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-coral/10 text-coral">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-charcoal">
            You might like {next.displayName}
          </p>
          {next.blockedBy && (
            <p className="mt-0.5 text-[10px] text-warmgrey">
              Often after {getConnectorDefinition(next.blockedBy).displayName}
            </p>
          )}
          <p className="mt-1 text-[10px] leading-relaxed text-warmgrey">{next.reason}</p>
          {recommendations.length > 1 && (
            <p className="mt-1.5 text-[9px] text-warmgrey/90">
              Also consider{" "}
              {recommendations
                .slice(1, 3)
                .map((r) => r.displayName)
                .join(", ")}
            </p>
          )}
        </div>
      </div>
      {onBrowse && (
        <button
          type="button"
          onClick={onBrowse}
          className="mt-2.5 w-full rounded-xl border border-line/35 bg-white py-2 text-[10px] font-semibold text-charcoal transition hover:bg-sand/50"
        >
          Browse marketplace
        </button>
      )}
    </div>
  );
}
