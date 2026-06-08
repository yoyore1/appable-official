"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Globe, Smartphone, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

type View = "app" | "website";

/**
 * Simple App / Website toggle above the preview. Website only explains why
 * apps need a site — no website build yet.
 */
export function PreviewCanvasPicker({
  appName,
  className,
}: {
  appName: string;
  className?: string;
}) {
  const [view, setView] = useState<View>("app");
  const [websiteNote, setWebsiteNote] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!websiteNote) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [websiteNote]);

  function onWebsiteClick() {
    setView("website");
    setWebsiteNote(true);
  }

  function backToApp() {
    setView("app");
    setWebsiteNote(false);
  }

  return (
    <>
      <div
        className={cn(
          "inline-flex items-center rounded-lg border border-line/50 bg-white/90 p-0.5 shadow-sm backdrop-blur-sm",
          className
        )}
        role="tablist"
        aria-label="Preview type"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "app"}
          onClick={backToApp}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
            view === "app"
              ? "bg-charcoal text-white shadow-sm"
              : "text-warmgrey hover:text-charcoal"
          )}
        >
          <Smartphone className="h-3.5 w-3.5" />
          App
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "website"}
          onClick={onWebsiteClick}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
            view === "website"
              ? "bg-charcoal text-white shadow-sm"
              : "text-warmgrey hover:text-charcoal"
          )}
        >
          <Globe className="h-3.5 w-3.5" />
          Website
        </button>
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {websiteNote && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center bg-charcoal/40 p-4 backdrop-blur-[3px]"
                onClick={backToApp}
              >
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ type: "spring", damping: 26, stiffness: 340 }}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="website-note-title"
                  className="relative isolate w-full max-w-sm rounded-2xl border border-line/40 bg-white p-5 shadow-[0_20px_50px_-16px_rgba(43,38,36,0.28)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={backToApp}
                    className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-warmgrey transition hover:bg-sand hover:text-charcoal"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-coral/12 text-coral">
                    <Globe className="h-5 w-5" />
                  </span>

                  <h2
                    id="website-note-title"
                    className="mt-3 font-display text-lg font-semibold text-charcoal"
                  >
                    You&apos;ll need a landing page
                  </h2>

                  <p className="mt-2 text-sm leading-relaxed text-warmgrey">
                    When you ship <span className="font-medium text-charcoal-soft">{appName}</span>{" "}
                    to the App Store or Google Play, you&apos;re asked for a website link — and you
                    actually need one. A simple landing page with screenshots, what the app does,
                    and a download button is basically required.
                  </p>

                  <p className="mt-2 text-sm leading-relaxed text-warmgrey">
                    A proper website also helps people find you on Google, gives you one link to
                    share anywhere, and lets you collect emails before launch.
                  </p>

                  <p className="mt-2 text-sm leading-relaxed text-warmgrey">
                    We&apos;re building your mobile app first. A matching landing page and website
                    are coming soon — you&apos;ll be able to make them right here.
                  </p>

                  <button
                    type="button"
                    onClick={backToApp}
                    className="btn-primary mt-4 w-full !py-2.5 text-sm"
                  >
                    Back to app preview
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
