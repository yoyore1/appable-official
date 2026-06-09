"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MousePointer2, Paintbrush } from "lucide-react";
import { cn } from "@/lib/utils";

const HOVER_HINT_MS = 1000;
const COLUMN = "w-full max-w-[min(300px,78vw)]";

export type EditPick = "content" | "surface";

export function PreviewEditChrome({
  active,
  chatMode,
  editPick,
  onEditPickChange,
  onToggle,
  onDone,
  disabled,
  children,
  className,
}: {
  active: boolean;
  chatMode: "brainstorm" | "build";
  editPick?: EditPick;
  onEditPickChange?: (pick: EditPick) => void;
  onToggle: () => void;
  onDone: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [showHint, setShowHint] = useState(false);
  const [hintPos, setHintPos] = useState<{ top: number; left: number } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const hintTitle =
    chatMode === "brainstorm"
      ? "Ask about one piece of your app"
      : "Change one piece of your app";

  const hintBody =
    chatMode === "brainstorm"
      ? "Tap Edit, then use Text for buttons and copy or Colors for backgrounds. Tap something on the preview — we suggest questions about conversion, trust, and clarity. Nothing changes until you build."
      : "Tap Edit, then use Text to change copy or Colors for backgrounds. Tap what you want to fix — type and Save, or use quick tweaks. Updates on the preview right away.";

  const barHint =
    editPick === "surface"
      ? chatMode === "brainstorm"
        ? "Tap a button, card, or empty background — ask about the color."
        : "Tap a button, card, or empty background to change its color."
      : chatMode === "brainstorm"
        ? "Tap text or buttons — ask about wording and clarity."
        : "Tap text or buttons to change them.";

  function clearHoverTimer() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }

  function updateHintPosition() {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setHintPos({
      top: rect.top - 8,
      left: rect.right,
    });
  }

  useEffect(() => () => clearHoverTimer(), []);

  useEffect(() => {
    if (!showHint) return;
    updateHintPosition();
    window.addEventListener("scroll", updateHintPosition, true);
    window.addEventListener("resize", updateHintPosition);
    return () => {
      window.removeEventListener("scroll", updateHintPosition, true);
      window.removeEventListener("resize", updateHintPosition);
    };
  }, [showHint]);

  function handlePointerEnter() {
    if (disabled || active) return;
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => {
      updateHintPosition();
      setShowHint(true);
    }, HOVER_HINT_MS);
  }

  function handlePointerLeave() {
    clearHoverTimer();
    setShowHint(false);
  }

  const hintPortal =
    showHint &&
    hintPos &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        role="tooltip"
        style={{
          position: "fixed",
          top: hintPos.top,
          left: hintPos.left,
          transform: "translate(-100%, -100%)",
          zIndex: 300,
        }}
        className="pointer-events-none w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-line/35 bg-white px-3 py-2.5 text-left shadow-[0_12px_40px_-8px_rgba(43,38,36,0.22)]"
      >
        <p className="text-[11px] font-semibold leading-snug text-charcoal">{hintTitle}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-charcoal-soft">{hintBody}</p>
        <span
          className="absolute -bottom-1.5 right-4 h-3 w-3 rotate-45 border-b border-r border-line/35 bg-white"
          aria-hidden
        />
      </div>,
      document.body
    );

  const editBar = active ? (
    <div
      className={cn(
        COLUMN,
        "flex items-center justify-between gap-2 rounded-xl border border-coral/30 bg-gradient-to-r from-coral/[0.08] to-white/90 px-3 py-2 shadow-[0_4px_16px_-8px_rgba(255,122,99,0.2)] backdrop-blur-sm"
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold tracking-tight text-charcoal">Edit</p>
        <p className="text-[10px] leading-snug text-charcoal-soft/90">{barHint}</p>
        {onEditPickChange && (
          <div className="mt-1.5 flex gap-1">
            <button
              type="button"
              onClick={() => onEditPickChange("content")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-semibold transition",
                editPick !== "surface"
                  ? "border-coral/35 bg-white text-charcoal"
                  : "border-transparent text-charcoal-soft hover:bg-white/60"
              )}
            >
              <MousePointer2 className="h-3 w-3 text-coral" />
              Text
            </button>
            <button
              type="button"
              onClick={() => onEditPickChange("surface")}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-semibold transition",
                editPick === "surface"
                  ? "border-coral/35 bg-white text-charcoal"
                  : "border-transparent text-charcoal-soft hover:bg-white/60"
              )}
            >
              <Paintbrush className="h-3 w-3 text-coral" />
              Colors
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDone}
        className="shrink-0 rounded-lg border border-line/40 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-charcoal hover:bg-sand/50"
      >
        Done
      </button>
    </div>
  ) : (
    <div className={cn(COLUMN, "relative z-[60] flex justify-end")}>
      <div
        onMouseEnter={handlePointerEnter}
        onMouseLeave={handlePointerLeave}
        onFocus={handlePointerEnter}
        onBlur={handlePointerLeave}
      >
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={onToggle}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold transition",
            "border-line/40 bg-white/95 text-charcoal shadow-sm hover:border-coral/35 hover:bg-coral/[0.04]",
            disabled && "pointer-events-none opacity-40"
          )}
        >
          <MousePointer2 className="h-3.5 w-3.5 text-coral" />
          Edit
        </button>
      </div>
    </div>
  );

  return (
    <div className={cn("relative flex flex-col gap-2", COLUMN, className)}>
      {hintPortal}
      {editBar}

      <div className="flex flex-col items-center gap-2">{children}</div>
    </div>
  );
}
