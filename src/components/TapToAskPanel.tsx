"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Loader2, Wand2, X } from "lucide-react";
import { PreviewMediaPick } from "@/components/PreviewMediaPick";
import { appendCoachContext, buildPreviewCoachContext } from "@/lib/expoApp/previewCoachContext";
import {
  buildTapToAskDraftPrompt,
  getTapToAskSuggestions,
  type TapToAskSuggestion,
} from "@/lib/expoApp/tapToAsk";
import type { TweakTarget } from "@/lib/expoApp/tweakPaths";
import { getStringAtPath, isMediaTarget, supportsColorTweak } from "@/lib/expoApp/tweakPaths";
import type { ExpoAppModel } from "@/lib/expoApp/types";
import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";

export function TapToAskPanel({
  target,
  model,
  plan,
  interview = [],
  busy,
  onClose,
  onAsk,
}: {
  target: TweakTarget;
  model: ExpoAppModel;
  plan: MasterBuildPrompt;
  interview?: InterviewTurn[];
  busy?: boolean;
  onClose: () => void;
  onAsk: (suggestion: TapToAskSuggestion) => void;
}) {
  const coach = useMemo(
    () => buildPreviewCoachContext(plan, interview, model),
    [plan, interview, model]
  );
  const suggestions = getTapToAskSuggestions(model, target, coach);
  const currentValue = getStringAtPath(model, target.path).trim();
  const isMedia = isMediaTarget(target);
  const isColor = supportsColorTweak(target.path) && !isMedia;
  const [draft, setDraft] = useState(currentValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(currentValue);
  }, [target.path, currentValue]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  function askDraft() {
    if (!draft.trim() || busy) return;
    onAsk({
      id: "draft",
      label: "Ask",
      prompt: buildTapToAskDraftPrompt(model, target, draft, coach),
    });
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-line/35 bg-white/95 shadow-[0_8px_28px_-10px_rgba(43,38,36,0.15)]">
      <div className="flex items-start justify-between gap-2 border-b border-line/25 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-coral">Selected</p>
          <p className="truncate text-sm font-semibold text-charcoal">{target.label}</p>
          <p className="text-xs text-warmgrey">{target.field}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-warmgrey hover:bg-sand/60"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-2">
        <div className="rounded-2xl border border-line/35 bg-white p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          {isMedia ? (
            <PreviewMediaPick
              target={target}
              currentValue={currentValue}
              busy={busy}
              askMode
              onUpload={() => {}}
              onAskAboutMedia={(note) =>
                onAsk({
                  id: "media",
                  label: "Ask",
                  prompt: appendCoachContext(note, coach),
                })
              }
            />
          ) : isColor ? (
            <div className="flex flex-col gap-2 px-1 py-0.5">
              <div className="flex items-center gap-2">
                <span
                  className="h-9 w-9 shrink-0 rounded-xl border border-line shadow-inner"
                  style={{ background: currentValue || "#FF7A63" }}
                  aria-hidden
                />
                <p className="text-[11px] leading-snug text-charcoal-soft">
                  Ask about this color — nothing changes until you build.
                </p>
              </div>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  askDraft();
                }
              }}
              rows={2}
              disabled={busy}
              placeholder="Type your wording…"
              className="w-full min-h-[3.25rem] resize-none border-0 bg-transparent px-1 py-1 text-sm leading-relaxed text-charcoal outline-none placeholder:text-warmgrey/80"
            />
          )}

          <div className="mt-2 flex flex-col gap-1">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                onClick={() => onAsk(s)}
                className="flex w-full items-center gap-2 rounded-xl border border-line/40 px-3 py-2 text-left text-[11px] font-medium text-charcoal transition hover:border-coral/35 hover:bg-cream/70 disabled:opacity-50"
              >
                <Wand2 className="h-3.5 w-3.5 shrink-0 text-coral" />
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          {!isMedia && !isColor && (
            <div className="mt-2 flex items-center justify-end gap-2 border-t border-line/20 pt-2">
              {busy && (
                <span className="mr-auto flex items-center gap-1.5 text-[10px] text-warmgrey">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Asking…
                </span>
              )}
              <button
                type="button"
                disabled={busy || !draft.trim()}
                onClick={askDraft}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-coral to-[#ff6b54] text-white shadow-[0_4px_12px_-4px_rgba(255,122,99,0.65)] transition hover:brightness-105 disabled:opacity-40"
                aria-label="Ask in chat"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          )}

          {isColor && busy && (
            <p className="mt-2 flex items-center gap-1.5 px-1 text-[10px] text-warmgrey">
              <Loader2 className="h-3 w-3 animate-spin" />
              Asking…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
