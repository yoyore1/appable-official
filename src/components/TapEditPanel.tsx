"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import type { TapPayload } from "@/components/ExpoWorkspacePreview";

function rgbToHex(input: string): string {
  if (!input) return "#000000";
  if (input.startsWith("#")) return input;
  const m = input.match(/rgba?\(([^)]+)\)/);
  if (!m) return "#000000";
  const parts = m[1]!.split(",").map((p) => parseFloat(p.trim()));
  const [r, g, b] = parts;
  if (r == null || g == null || b == null) return "#000000";
  const hex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export interface TapEditValue {
  text?: string;
  color?: string;
  background?: string;
}

/** Edit panel for a tapped element on the real app: text, text color, background. */
export function TapEditPanel({
  target,
  busy,
  onChange,
  onClose,
}: {
  target: TapPayload;
  busy?: boolean;
  /** Fires on every change for instant (optimistic) preview + debounced save. */
  onChange: (value: TapEditValue) => void;
  onClose: () => void;
}) {
  const isText = target.kind === "text";
  const editsBackground = target.kind !== "text";

  const [text, setText] = useState(target.text ?? "");
  const [color, setColor] = useState(rgbToHex(target.color));
  const [background, setBackground] = useState(rgbToHex(target.background));

  useEffect(() => {
    setText(target.text ?? "");
    setColor(rgbToHex(target.color));
    setBackground(rgbToHex(target.background));
  }, [target]);

  const label =
    target.kind === "screen"
      ? "Screen background"
      : target.kind === "box"
        ? "Box / card"
        : "Text";

  return (
    <div className="w-[min(280px,80vw)] rounded-2xl border border-line/50 bg-white p-3 shadow-[0_18px_50px_-20px_rgba(43,38,36,0.45)]">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wide text-warmgrey">
          {label}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-warmgrey transition hover:bg-sand/60 hover:text-charcoal"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {isText && (
        <label className="block">
          <span className="text-[10px] font-semibold text-warmgrey">Text</span>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onChange({ text: e.target.value });
            }}
            rows={2}
            className="mt-1 w-full resize-none rounded-xl border border-line bg-white px-2.5 py-2 text-sm text-charcoal outline-none focus:border-coral/50"
          />
        </label>
      )}

      {isText && (
        <label className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-warmgrey">Text color</span>
          <span className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                onChange({ color: e.target.value });
              }}
              className="h-7 w-9 cursor-pointer rounded border border-line bg-white"
            />
            <span className="text-[10px] text-warmgrey">{color}</span>
          </span>
        </label>
      )}

      {editsBackground && (
        <label className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-warmgrey">
            Background color
          </span>
          <span className="flex items-center gap-2">
            <input
              type="color"
              value={background}
              onChange={(e) => {
                setBackground(e.target.value);
                onChange({ background: e.target.value });
              }}
              className="h-7 w-9 cursor-pointer rounded border border-line bg-white"
            />
            <span className="text-[10px] text-warmgrey">{background}</span>
          </span>
        </label>
      )}

      <button
        type="button"
        onClick={onClose}
        disabled={busy}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-coral px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-coral-deep disabled:opacity-60"
      >
        <Check className="h-3 w-3" /> {busy ? "Saving…" : "Done"}
      </button>
    </div>
  );
}
