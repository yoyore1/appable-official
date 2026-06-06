"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";

/** Soft-confetti celebration moment. Drop this in to fire once on mount. */
export function Confetti({ fire = true }: { fire?: boolean }) {
  useEffect(() => {
    if (!fire) return;
    const colors = ["#FF7A63", "#FFD1B2", "#56A274", "#FFA896"];
    const end = Date.now() + 900;
    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 60,
        origin: { x: 0 },
        colors,
        scalar: 0.9,
        gravity: 0.8,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 60,
        origin: { x: 1 },
        colors,
        scalar: 0.9,
        gravity: 0.8,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [fire]);

  return null;
}
