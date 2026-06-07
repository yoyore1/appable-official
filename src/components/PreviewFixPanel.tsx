"use client";

import { useState } from "react";
import { Loader2, Wand2, X } from "lucide-react";
import type { TweakTarget } from "@/lib/expoApp/tweakPaths";
import {
  canRemovePath,
  supportsAccentTweak,
  supportsImageSwap,
} from "@/lib/expoApp/tweakPaths";
import type { SelectionTweakAction } from "@/lib/expoApp/applySelectionTweak";

export function PreviewFixPanel({
  target,
  currentValue,
  busy,
  onClose,
  onApply,
}: {
  target: TweakTarget;
  currentValue: string;
  busy?: boolean;
  onClose: () => void;
  onApply: (action: SelectionTweakAction) => void;
}) {
  const [draft, setDraft] = useState(currentValue);

  return (
    <div className="rounded-2xl border border-coral/30 bg-white p-3 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-coral">Selected</p>
          <p className="truncate text-sm font-semibold text-charcoal">{target.label}</p>
          <p className="text-xs text-warmgrey">{target.field}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-warmgrey hover:bg-cream"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-coral/50"
          disabled={busy}
        />
        <button
          type="button"
          disabled={busy || draft.trim() === currentValue.trim()}
          onClick={() => onApply({ type: "set", value: draft })}
          className="btn-primary !px-3 !py-2 text-xs"
        >
          Save
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <QuickBtn
          label="Shorter"
          disabled={busy}
          onClick={() => onApply({ type: "rewrite_shorter" })}
        />
        <QuickBtn
          label="Friendlier"
          disabled={busy}
          onClick={() => onApply({ type: "rewrite_friendly" })}
        />
        <QuickBtn
          label="More pro"
          disabled={busy}
          onClick={() => onApply({ type: "rewrite_pro" })}
        />
        {supportsAccentTweak(target.path) && (
          <QuickBtn
            label="Brighter color"
            disabled={busy}
            onClick={() => onApply({ type: "accent_brighter" })}
          />
        )}
        {supportsImageSwap(target.path) && (
          <QuickBtn
            label="New photo"
            disabled={busy}
            onClick={() => onApply({ type: "swap_image" })}
          />
        )}
        {canRemovePath(target.path) && (
          <QuickBtn
            label="Remove"
            disabled={busy}
            danger
            onClick={() => onApply({ type: "remove" })}
          />
        )}
      </div>

      {busy && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-warmgrey">
          <Loader2 className="h-3 w-3 animate-spin" />
          Updating preview…
        </p>
      )}
    </div>
  );
}

function QuickBtn({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
        danger
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-line text-charcoal hover:border-coral/40 hover:bg-cream"
      }`}
    >
      {!danger && <Wand2 className="h-3 w-3 text-coral" />}
      {label}
    </button>
  );
}
