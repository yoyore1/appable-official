"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyProjectId({
  projectId,
  compact,
}: {
  projectId: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(projectId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={
        compact
          ? "inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-cream px-3 py-2 text-xs font-semibold text-charcoal transition hover:border-coral/40 hover:bg-coral/5"
          : "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-cream px-4 py-3 text-sm font-semibold text-charcoal transition hover:border-coral/40 hover:bg-coral/5"
      }
    >
      {copied ? (
        <>
          <Check className={compact ? "h-3.5 w-3.5 text-moss" : "h-4 w-4 text-moss"} />
          Copied!
        </>
      ) : (
        <>
          <Copy className={compact ? "h-3.5 w-3.5 text-warmgrey" : "h-4 w-4 text-warmgrey"} />
          Copy project ID
        </>
      )}
    </button>
  );
}
