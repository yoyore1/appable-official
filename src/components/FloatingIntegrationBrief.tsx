"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, Telescope } from "lucide-react";

/** Compact chip — centered above “What to do next”, matches Build handoff placement. */
export function FloatingIntegrationBrief({
  visible,
  label,
  hint,
  busy,
  onRun,
}: {
  visible: boolean;
  label: string;
  hint: string;
  busy?: boolean;
  onRun: () => void;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 480, damping: 26 }}
          className="mb-2 flex justify-center px-2"
        >
          <button
            type="button"
            disabled={busy}
            onClick={onRun}
            className="max-w-full rounded-2xl border border-charcoal/15 bg-charcoal px-4 py-2.5 text-left text-white shadow-[0_8px_28px_-8px_rgba(43,38,36,0.45),0_0_0_1px_rgba(255,255,255,0.08)] transition hover:brightness-110 disabled:opacity-60"
          >
            <span className="flex items-center gap-2">
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Telescope className="h-3.5 w-3.5 shrink-0 text-coral" aria-hidden />
              )}
              <span className="min-w-0 truncate text-xs font-semibold">{label}</span>
              {!busy && <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />}
            </span>
            <span className="mt-0.5 block pl-[1.375rem] text-[10px] leading-snug text-white/70">
              {hint}
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
