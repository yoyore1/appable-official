import { cn } from "@/lib/utils";

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function ctaFromFeature(feature: string): string {
  const f = feature.trim();
  if (!f) return "Get started";
  const words = f.split(/\s+/).slice(0, 3).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Phone-preview thumbnail — shows real app content when description/features are passed.
 */
export function PhonePreview({
  hue = 8,
  label,
  status,
  description,
  features,
  className,
  compact,
}: {
  hue?: number;
  label?: string;
  status?: string;
  description?: string;
  features?: string[];
  className?: string;
  compact?: boolean;
}) {
  const initials = label
    ? label
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "A";

  const accent = `hsl(${hue} 78% 58%)`;
  const accentSoft = `hsl(${hue} 55% 94%)`;
  const screenBg = `linear-gradient(180deg, hsl(${hue} 40% 98%) 0%, hsl(${hue} 25% 96%) 100%)`;

  const hasContent = Boolean(description?.trim() || features?.length);
  const shownFeatures = (features ?? []).slice(0, compact ? 2 : 3);
  const cta = ctaFromFeature(features?.[0] ?? "Get started");

  return (
    <div
      className={cn(
        "mx-auto w-full",
        compact ? "max-w-[188px]" : "max-w-[240px]",
        className
      )}
    >
      <div
        className="relative rounded-[2.4rem] p-[5px] shadow-[0_20px_50px_-12px_rgba(43,38,36,0.22)]"
        style={{
          background: "linear-gradient(145deg, #3d3836 0%, #1f1c1b 55%, #2a2624 100%)",
        }}
      >
        <span className="absolute -left-[2px] top-[22%] h-8 w-[3px] rounded-l bg-charcoal/60" />
        <span className="absolute -left-[2px] top-[34%] h-12 w-[3px] rounded-l bg-charcoal/60" />
        <span className="absolute -right-[2px] top-[28%] h-14 w-[3px] rounded-r bg-charcoal/60" />

        <div
          className={cn(
            "relative overflow-hidden rounded-[2rem]",
            compact ? "aspect-[9/18.5]" : "aspect-[9/19.5]"
          )}
          style={{ background: screenBg }}
        >
          <div className="flex items-center justify-between px-4 pt-2.5">
            <span className="text-[9px] font-semibold text-charcoal/70">9:41</span>
            <div className="h-[18px] w-[72px] rounded-full bg-charcoal/90" aria-hidden />
            <div className="flex gap-[3px]">
              <span className="h-2 w-2 rounded-sm bg-charcoal/50" />
              <span className="h-2 w-3 rounded-sm bg-charcoal/50" />
            </div>
          </div>

          <div className="flex h-[calc(100%-28px)] flex-col px-3.5 pb-7 pt-2">
            {/* App header */}
            <div className="flex items-center gap-2">
              <div
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-[10px] font-bold text-white shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${accent}, hsl(${hue + 12} 70% 48%))`,
                }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                {label && (
                  <p className="truncate text-[10px] font-bold leading-tight text-charcoal">
                    {label}
                  </p>
                )}
                {status && (
                  <p className="truncate text-[8px] text-charcoal/45">{status}</p>
                )}
              </div>
            </div>

            {hasContent ? (
              <>
                {/* Hero — real description */}
                {description && (
                  <div
                    className="mt-2.5 rounded-xl p-2.5"
                    style={{ background: accentSoft }}
                  >
                    <p className="line-clamp-4 text-[8px] leading-[1.35] text-charcoal/80">
                      {description}
                    </p>
                  </div>
                )}

                {/* Feature list — real features */}
                {shownFeatures.length > 0 && (
                  <div className="mt-2 flex-1 space-y-1.5 overflow-hidden">
                    {shownFeatures.map((f) => (
                      <div
                        key={f}
                        className="flex items-start gap-1.5 rounded-lg border border-charcoal/6 bg-white/85 px-2 py-1.5 shadow-sm"
                      >
                        <span
                          className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: accent }}
                        />
                        <p className="line-clamp-2 text-[7.5px] leading-[1.3] text-charcoal/75">
                          {clip(f, compact ? 52 : 64)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* CTA from first feature */}
                <div
                  className="mt-2 w-full truncate rounded-xl px-2 py-2 text-center text-[8px] font-semibold text-white shadow-sm"
                  style={{
                    background: `linear-gradient(90deg, ${accent}, hsl(${hue + 8} 72% 52%))`,
                  }}
                >
                  {clip(cta, 28)}
                </div>
              </>
            ) : (
              /* Skeleton fallback for cards / landing */
              <>
                <div className="mt-3 rounded-2xl p-3" style={{ background: accentSoft }}>
                  <div className="h-2 w-2/3 rounded-full bg-charcoal/12" />
                  <div className="mt-2 h-2 w-1/2 rounded-full bg-charcoal/8" />
                </div>
                <div className="mt-2.5 space-y-2">
                  {[0.85, 0.65].map((w, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-charcoal/6 bg-white/80 p-2.5 shadow-sm"
                    >
                      <div
                        className="h-2 rounded-full bg-charcoal/10"
                        style={{ width: `${w * 100}%` }}
                      />
                      <div className="mt-1.5 h-7 rounded-lg bg-charcoal/5" />
                    </div>
                  ))}
                </div>
                <div
                  className="mt-3 h-8 rounded-xl"
                  style={{
                    background: `linear-gradient(90deg, ${accent}, hsl(${hue + 8} 72% 52%))`,
                  }}
                />
              </>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-2 flex justify-center">
            <span className="h-1 w-16 rounded-full bg-charcoal/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
