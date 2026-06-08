"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Hammer, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export type BuildChatMode = "brainstorm" | "build";

const MODE_HELP: Record<
  BuildChatMode,
  { title: string; body: string }
> = {
  brainstorm: {
    title: "Brainstorm",
    body: "Talk through ideas — features, flows, who it's for. Great for planning. Your preview stays as-is.",
  },
  build: {
    title: "Build",
    body: "Ask for real changes and we'll update your app preview. Use Tap to fix to click and edit anything.",
  },
};

function ModeTab({
  mode,
  active,
  icon: Icon,
  label,
  activeClass,
  onSelect,
}: {
  mode: BuildChatMode;
  active: boolean;
  icon: typeof Lightbulb;
  label: string;
  activeClass: string;
  onSelect: () => void;
}) {
  const [showTip, setShowTip] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const help = MODE_HELP[mode];

  const openTip = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowTip(true);
  };

  const closeTip = () => {
    hideTimer.current = setTimeout(() => setShowTip(false), 100);
  };

  return (
    <div
      className="relative flex flex-1"
      onMouseEnter={openTip}
      onMouseLeave={closeTip}
    >
      <button
        type="button"
        role="tab"
        aria-selected={active}
        aria-describedby={showTip ? `mode-tip-${mode}` : undefined}
        onClick={onSelect}
        onFocus={openTip}
        onBlur={closeTip}
        className={cn(
          "relative z-10 flex w-full items-center justify-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold tracking-tight transition-colors",
          active ? activeClass : "text-charcoal/55 hover:text-charcoal/80"
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </button>

      {showTip && (
        <div
          id={`mode-tip-${mode}`}
          role="tooltip"
          className="absolute left-1/2 top-[calc(100%+8px)] z-50 w-[236px] -translate-x-1/2 rounded-xl border border-line/60 bg-white px-3.5 py-3 text-left shadow-[0_10px_32px_-10px_rgba(43,38,36,0.22)]"
          onMouseEnter={openTip}
          onMouseLeave={closeTip}
        >
          <span
            className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-l border-t border-line/50 bg-white"
            aria-hidden
          />
          <p className="text-[13px] font-bold text-charcoal">{help.title}</p>
          <p className="mt-1.5 text-xs font-medium leading-relaxed text-charcoal/90">{help.body}</p>
        </div>
      )}
    </div>
  );
}

export function BuildModeToggle({
  mode,
  onChange,
}: {
  mode: BuildChatMode;
  onChange: (mode: BuildChatMode) => void;
}) {
  return (
    <div
      className="relative z-20 mt-1.5 flex overflow-visible rounded-full border border-line/40 bg-cream/70 p-0.5 shadow-[inset_0_1px_2px_rgba(43,38,36,0.06)]"
      role="tablist"
      aria-label="Chat mode"
    >
      <motion.span
        layout
        className="absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full"
        animate={{
          left: mode === "brainstorm" ? 2 : "calc(50% + 0px)",
          boxShadow:
            mode === "brainstorm"
              ? "0 0 18px rgba(255, 209, 178, 0.65), 0 2px 8px rgba(255, 184, 154, 0.35)"
              : "0 0 22px rgba(255, 122, 99, 0.55), 0 2px 10px rgba(255, 92, 69, 0.35)",
        }}
        style={{
          background:
            mode === "brainstorm"
              ? "linear-gradient(135deg, #ffe8d6 0%, #ffd1b2 50%, #ffc4a3 100%)"
              : "linear-gradient(135deg, #ff8f7a 0%, #ff7a63 45%, #ff5c45 100%)",
        }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
      />
      <ModeTab
        mode="brainstorm"
        active={mode === "brainstorm"}
        icon={Lightbulb}
        label="Brainstorm"
        activeClass="text-charcoal drop-shadow-sm"
        onSelect={() => onChange("brainstorm")}
      />
      <ModeTab
        mode="build"
        active={mode === "build"}
        icon={Hammer}
        label="Build"
        activeClass="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]"
        onSelect={() => onChange("build")}
      />
    </div>
  );
}
