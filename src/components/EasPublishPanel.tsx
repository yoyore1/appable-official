"use client";

import { useState } from "react";
import { Rocket, Loader2 } from "lucide-react";
import { triggerEasPublish } from "@/server/projects";
import { cn } from "@/lib/utils";

export function EasPublishPanel({
  projectId,
  previewReady,
  className,
}: {
  projectId: string;
  previewReady: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!previewReady) return null;

  async function run(profile: "preview" | "production") {
    setBusy(true);
    setMessage(null);
    try {
      const res = await triggerEasPublish(projectId, profile);
      setMessage(res.ok ? res.message : res.setup ? `${res.message}\n\n${res.setup}` : res.message);
    } catch {
      setMessage("Couldn't start EAS build — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-warmgrey">
        Publish app
      </p>
      <p className="text-[11px] leading-snug text-warmgrey">
        Real Expo Router project in your workspace — EAS builds for TestFlight / Play internal testing.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run("preview")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-coral px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:bg-coral-deep disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
          EAS preview build
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run("production")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line/50 bg-white/80 px-3 py-2 text-[12px] font-semibold text-charcoal transition hover:bg-white disabled:opacity-50"
        >
          Store build
        </button>
        <a
          href={`/api/projects/${projectId}/export`}
          className="inline-flex items-center rounded-xl border border-line/50 bg-white/80 px-3 py-2 text-[12px] font-semibold text-charcoal transition hover:bg-white"
        >
          Download code
        </a>
      </div>
      {message ? (
        <p className="whitespace-pre-wrap rounded-lg border border-line/30 bg-white/70 px-3 py-2 text-[11px] leading-relaxed text-charcoal">
          {message}
        </p>
      ) : null}
    </div>
  );
}
