"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const STATUS_LINES = [
  "Pulling the right words…",
  "Sketching your app in my head…",
  "Cooking up something that fits…",
  "Got it — one sec…",
  "Almost there…",
  "Thinking through what you said…",
] as const;

/** iMessage-style typing bubble with rotating status microcopy. */
export function TypingIndicator() {
  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setLineIdx((i) => (i + 1) % STATUS_LINES.length);
    }, 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-start gap-1.5"
      aria-label="Appable is typing"
      role="status"
    >
      <div className="h-4 overflow-hidden pl-1">
        <AnimatePresence mode="wait">
          <motion.p
            key={lineIdx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="text-[11.5px] font-medium tracking-wide text-warmgrey/75"
          >
            {STATUS_LINES[lineIdx]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="flex min-h-[44px] items-center gap-[5px] rounded-3xl rounded-bl-lg bg-cream px-[18px] py-3 shadow-soft">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block h-[7px] w-[7px] rounded-full bg-warmgrey/55"
            animate={{ y: [0, -5, 0], opacity: [0.45, 1, 0.45] }}
            transition={{
              duration: 0.85,
              repeat: Infinity,
              delay: i * 0.18,
              ease: [0.45, 0, 0.55, 1],
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
