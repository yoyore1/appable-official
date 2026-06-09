"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { isImageUrlValue } from "@/lib/expoApp/tweakPaths";
import type { TweakTarget } from "@/lib/expoApp/tweakPaths";

async function fileToDataUrl(file: File, maxPx: number): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
  if (!raw.startsWith("data:image/")) return raw;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Invalid image"));
    el.src = raw;
  });

  const scale = Math.min(1, maxPx / Math.max(img.width, img.height, 1));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.88);
}

export function PreviewMediaPick({
  target,
  currentValue,
  busy,
  onUpload,
  onEmoji,
  askMode,
  onAskAboutMedia,
}: {
  target: TweakTarget;
  currentValue: string;
  busy?: boolean;
  onUpload: (dataUrl: string) => void;
  onEmoji?: (emoji: string) => void;
  /** Brainstorm — suggest in chat instead of changing preview. */
  askMode?: boolean;
  onAskAboutMedia?: (note: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isIcon = target.field === "icon";
  const preview = localPreview ?? (isImageUrlValue(currentValue) ? currentValue : null);
  const emoji = !isImageUrlValue(currentValue) ? currentValue.trim() : "";

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    setErr(null);
    try {
      const maxPx = isIcon ? 128 : 720;
      const dataUrl = await fileToDataUrl(file, maxPx);
      setLocalPreview(dataUrl);
      if (askMode && onAskAboutMedia) {
        onAskAboutMedia(
          `I want to use my own ${isIcon ? "icon" : "image"} for ${target.label} (${file.name}).`
        );
      } else {
        onUpload(dataUrl);
      }
    } catch {
      setErr("That file didn't work — try a JPG or PNG.");
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-cream text-lg">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : emoji ? (
            <span aria-hidden>{emoji}</span>
          ) : (
            <ImageIcon className="h-4 w-4 text-warmgrey" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-charcoal">
            {isIcon ? "Icon" : "Image"}
          </p>
          <p className="text-[10px] text-warmgrey">
            {askMode ? "Pick a file — we'll talk it through in chat." : "Choose from your computer"}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-[11px] font-semibold text-charcoal transition hover:border-coral/40 hover:bg-cream disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-coral" />
        ) : (
          <Upload className="h-3.5 w-3.5 text-coral" />
        )}
        {isIcon ? "Upload icon" : "Upload image"}
      </button>

      {isIcon && onEmoji && !askMode && (
        <div className="flex gap-2">
          <input
            defaultValue={emoji}
            placeholder="Or paste an emoji…"
            maxLength={4}
            disabled={busy}
            className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-coral/50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.currentTarget.value.trim()) {
                onEmoji(e.currentTarget.value.trim());
              }
            }}
          />
          <button
            type="button"
            disabled={busy}
            className="btn-primary !px-3 !py-2 text-xs"
            onClick={(e) => {
              const input = (e.currentTarget.previousElementSibling as HTMLInputElement | null);
              const v = input?.value.trim();
              if (v) onEmoji(v);
            }}
          >
            Save
          </button>
        </div>
      )}

      {err && <p className="text-[10px] text-red-600">{err}</p>}
    </div>
  );
}
