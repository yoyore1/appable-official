"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

const HOVER_HINT_MS = 1000;

export function VoiceMicButton({
  listening = false,
  transcribing = false,
  disabled = false,
  onClick,
  className,
  size = "md",
}: {
  listening?: boolean;
  transcribing?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const icon = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const [showHint, setShowHint] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearHoverTimer() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }

  useEffect(() => () => clearHoverTimer(), []);

  function handlePointerEnter() {
    if (disabled || transcribing || listening) return;
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => setShowHint(true), HOVER_HINT_MS);
  }

  function handlePointerLeave() {
    clearHoverTimer();
    setShowHint(false);
  }

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={handlePointerEnter}
      onMouseLeave={handlePointerLeave}
      onFocus={handlePointerEnter}
      onBlur={handlePointerLeave}
    >
      {showHint && (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-[min(15rem,calc(100vw-2rem))] rounded-xl border border-line/35 bg-white px-3 py-2.5 text-left shadow-[0_8px_28px_-8px_rgba(43,38,36,0.18)]"
        >
          <p className="text-[11px] font-semibold leading-snug text-charcoal">
            You can talk instead of typing
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-charcoal-soft">
            Tap the mic and say what you want. We&apos;ll put it in the box for you to
            check before you send.
          </p>
          <span
            className="absolute -bottom-1.5 right-3 h-3 w-3 rotate-45 border-b border-r border-line/35 bg-white"
            aria-hidden
          />
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        disabled={disabled || transcribing}
        aria-label={
          transcribing
            ? "Transcribing speech"
            : listening
              ? "Stop listening"
              : "Dictate with your voice"
        }
        className={cn(
          "grid place-items-center rounded-xl border transition",
          dim,
          listening
            ? "border-coral/50 bg-coral/15 text-coral shadow-[0_0_0_3px_rgba(255,122,99,0.15)]"
            : "border-line/40 bg-white/90 text-warmgrey hover:border-coral/35 hover:bg-coral/[0.06] hover:text-coral",
          (disabled || transcribing) && "pointer-events-none opacity-40",
          className
        )}
      >
        {transcribing ? (
          <Loader2 className={cn(icon, "animate-spin text-coral")} />
        ) : (
          <Mic className={cn(icon, listening && "text-coral")} />
        )}
      </button>
    </div>
  );
}
