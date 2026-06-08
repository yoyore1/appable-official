"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Hammer, Loader2 } from "lucide-react";

/** Compact chip — centered above “What to do next”, in normal layout flow. */
export function FloatingBuildHandoff({
  visible,
  label,
  busy,
  onBuild,
}: {
  visible: boolean;
  label: string;
  busy?: boolean;
  onBuild: () => void;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 480, damping: 26 }}
          className="mb-2 flex justify-center"
        >
          <button
            type="button"
            disabled={busy}
            onClick={onBuild}
            className="inline-flex items-center gap-2 rounded-full border border-coral/40 bg-charcoal px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_28px_-8px_rgba(43,38,36,0.45),0_0_0_1px_rgba(255,122,99,0.25)] transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Hammer className="h-3.5 w-3.5" aria-hidden />
            )}
            {label}
            {!busy && <ArrowRight className="h-3.5 w-3.5" aria-hidden />}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
