import { Play } from "lucide-react";

/** Premium video slot — cream/coral palette, same layout as before. */
export function ExplainerVideoPlaceholder() {
  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-line/70 bg-sand shadow-[0_20px_50px_-20px_rgba(255,122,99,0.22)]">
      <div className="absolute inset-0 bg-gradient-to-br from-cream via-sand to-peach/35" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_15%_10%,rgba(255,122,99,0.18),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_95%_90%,rgba(255,209,178,0.45),transparent_50%)]" />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(232,222,211,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(232,222,211,0.9) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden
      />

      <div className="relative flex h-full flex-col items-center justify-center px-6">
        <div className="relative">
          <span
            className="absolute inset-0 rounded-full bg-coral/20 opacity-70 blur-2xl transition group-hover:scale-110"
            aria-hidden
          />
          <div className="relative grid h-[4.25rem] w-[4.25rem] place-items-center rounded-full border border-coral/25 bg-white/90 shadow-[0_8px_28px_-8px_rgba(255,122,99,0.45)] transition group-hover:scale-105 group-hover:border-coral/40">
            <Play className="ml-0.5 h-7 w-7 fill-coral text-coral" strokeWidth={1.5} />
          </div>
        </div>
        <p className="mt-5 text-sm font-semibold text-charcoal">
          Watch the full walkthrough
        </p>
        <p className="mt-1 text-xs text-warmgrey">Explainer video coming soon</p>
      </div>

      <span className="absolute left-3 top-3 rounded-md border border-line/80 bg-white/85 px-2 py-0.5 text-[10px] font-medium tabular-nums text-charcoal-soft shadow-soft backdrop-blur-sm">
        0:60
      </span>
      <span className="absolute bottom-3 right-3 rounded-md border border-line/80 bg-white/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-warmgrey shadow-soft backdrop-blur-sm">
        Preview
      </span>
    </div>
  );
}
