"use client";

import { useEffect } from "react";
import { scrollToBuildBox } from "@/lib/scrollToBuild";

/** On load with #start or #build-box, scroll to the input — not the middle of the page. */
export function LandingHashScroll() {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash !== "#start" && hash !== "#build-box") return;
    const run = () => scrollToBuildBox(hash === "#build-box");
    requestAnimationFrame(run);
    const t = window.setTimeout(run, 100);
    return () => window.clearTimeout(t);
  }, []);

  return null;
}
