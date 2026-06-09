"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyableValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-line/25 bg-white p-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-warmgrey">{label}</p>
      <div className="mt-1.5 flex items-start gap-1.5">
        <code className="min-w-0 flex-1 break-all text-[9px] leading-relaxed text-charcoal">
          {value}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-lg border border-line/30 bg-sand/40 p-1.5 text-warmgrey transition hover:bg-sand hover:text-charcoal"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}
