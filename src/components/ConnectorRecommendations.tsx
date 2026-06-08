"use client";

import { getConnectorDefinition, type ConnectorRecommendation } from "@/lib/connectors/registry";

/** What to connect next — driven by connector registry + app needs. */
export function ConnectorRecommendations({
  recommendations,
}: {
  recommendations: ConnectorRecommendation[];
}) {
  if (recommendations.length === 0) return null;

  const next = recommendations[0];

  return (
    <div className="rounded-lg border border-coral/25 bg-coral/[0.06] px-2.5 py-2">
      <p className="text-[9px] font-bold text-charcoal">
        Recommended: {next.displayName}
        {next.blockedBy && (
          <span className="font-normal text-warmgrey">
            {" "}
            (after {getConnectorDefinition(next.blockedBy).displayName})
          </span>
        )}
      </p>
      <p className="mt-0.5 text-[9px] leading-snug text-warmgrey">{next.reason}</p>
      {recommendations.length > 1 && (
        <p className="mt-1 text-[8px] text-warmgrey">
          Also needed later:{" "}
          {recommendations
            .slice(1)
            .map((r) => r.displayName)
            .join(", ")}
        </p>
      )}
    </div>
  );
}
