import Link from "next/link";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils";

/** Friendly "build power" bar. Gentle pulse when low — nudge, never nag. */
export function BuildPowerBar({
  power,
  max = 7000,
  className,
  compact = false,
}: {
  power: number;
  max?: number;
  className?: string;
  compact?: boolean;
}) {
  const pct = Math.max(2, Math.min(100, Math.round((power / max) * 100)));
  const low = power < 200;

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-charcoal">
          <Zap className="h-4 w-4 text-coral" />
          Build power
        </span>
        <span className="text-sm text-charcoal-soft">{formatNumber(power)}</span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-sand">
        <div
          className={cn(
            "h-full rounded-full bg-coral transition-all duration-700",
            low && "animate-pulse-soft"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!compact && (
        <div className="mt-2 flex items-center justify-between">
          {low ? (
            <span className="text-xs text-coral-deep">You&apos;re running low — top up to keep going.</span>
          ) : (
            <span className="text-xs text-warmgrey">Plenty of power to keep building.</span>
          )}
          <Link href="/buy" className="text-xs font-medium text-coral hover:underline">
            Top up
          </Link>
        </div>
      )}
    </div>
  );
}
