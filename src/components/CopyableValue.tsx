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
    <div className="rounded-lg border border-line/35 bg-white/90 p-2">
      <p className="text-[9px] font-bold uppercase tracking-wide text-warmgrey">{label}</p>
      <div className="mt-1 flex items-start gap-1">
        <code className="min-w-0 flex-1 break-all text-[9px] leading-snug text-charcoal">
          {value}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded p-1 text-warmgrey hover:bg-sand/80 hover:text-charcoal"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-3 w-3 text-moss" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}
