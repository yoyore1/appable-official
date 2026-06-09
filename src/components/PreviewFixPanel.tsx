"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUp, Loader2, Wand2, X } from "lucide-react";
import type { TweakTarget } from "@/lib/expoApp/tweakPaths";
import { PreviewMediaPick } from "@/components/PreviewMediaPick";
import {
  canRemovePath,
  isMediaTarget,
  supportsAccentTweak,
  supportsColorTweak,
  supportsImageSwap,
} from "@/lib/expoApp/tweakPaths";
import type { SelectionTweakAction } from "@/lib/expoApp/applySelectionTweak";
import { buildPreviewCoachContext } from "@/lib/expoApp/previewCoachContext";
import { getTapToAskSuggestions } from "@/lib/expoApp/tapToAsk";
import type { ExpoAppModel } from "@/lib/expoApp/types";
import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";

export function PreviewFixPanel({
  target,
  currentValue,
  model,
  roleSibling,
  plan,
  interview = [],
  busy,
  statusMessage,
  onClose,
  onApply,
}: {
  target: TweakTarget;
  currentValue: string;
  model: ExpoAppModel;
  /** Other role-picker line (title vs gray description). */
  roleSibling?: { path: string; label: string; value: string };
  plan?: MasterBuildPrompt;
  interview?: InterviewTurn[];
  busy?: boolean;
  statusMessage?: string | null;
  onClose: () => void;
  onApply: (action: SelectionTweakAction, path?: string) => void;
}) {
  const [draft, setDraft] = useState(currentValue);
  const [siblingDraft, setSiblingDraft] = useState(roleSibling?.value ?? "");
  const [customInstruction, setCustomInstruction] = useState("");
  const roleField = target.path.match(/^flow\.roles\[\d+\]\.(label|description)$/)?.[1];

  const coach = useMemo(
    () => (plan ? buildPreviewCoachContext(plan, interview, model) : null),
    [plan, interview, model]
  );
  const suggestions = useMemo(
    () => getTapToAskSuggestions(model, target, coach),
    [model, target, coach]
  );

  useEffect(() => {
    setDraft(currentValue);
    setCustomInstruction("");
  }, [target.path, currentValue]);

  useEffect(() => {
    setSiblingDraft(roleSibling?.value ?? "");
  }, [roleSibling?.path, roleSibling?.value]);

  const isMedia = isMediaTarget(target);
  const isColor = supportsColorTweak(target.path) && !isMedia;
  const colorValue = /^#[0-9A-Fa-f]{6}$/.test(draft.trim()) ? draft.trim() : currentValue;
  function applyRewrite(instruction: string) {
    if (!instruction.trim()) return;
    onApply({ type: "rewrite_with", instruction: instruction.trim() }, target.path);
  }

  return (
    <div className="rounded-2xl border border-coral/30 bg-white p-3 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-coral">Selected</p>
          <p className="truncate text-sm font-semibold text-charcoal">{target.label}</p>
          <p className="text-xs text-warmgrey">{target.field}</p>
          {roleField === "description" && (
            <p className="mt-1 text-[10px] leading-snug text-warmgrey">
              Gray subtext under the role name — this is what users read on onboarding.
            </p>
          )}
          {plan?.audience?.trim() && (
            <p className="mt-1 text-[10px] leading-relaxed text-warmgrey">
              For <span className="font-medium text-charcoal-soft">{plan.audience}</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-warmgrey hover:bg-cream"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isMedia ? (
        <PreviewMediaPick
          target={target}
          currentValue={currentValue}
          busy={busy}
          onUpload={(dataUrl) => onApply({ type: "set", value: dataUrl })}
          onEmoji={
            target.field === "icon"
              ? (emoji) => onApply({ type: "set", value: emoji })
              : undefined
          }
        />
      ) : isColor ? (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="h-9 w-9 shrink-0 rounded-xl border border-line shadow-inner"
              style={{ background: colorValue }}
              aria-hidden
            />
            <input
              type="color"
              value={colorValue.startsWith("#") ? colorValue : "#FF7A63"}
              onChange={(e) => {
                setDraft(e.target.value.toUpperCase());
                onApply({ type: "set", value: e.target.value.toUpperCase() });
              }}
              className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-white p-0.5"
              disabled={busy}
            />
            <span className="text-xs font-mono text-warmgrey">{colorValue}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <QuickBtn label="Lighter" disabled={busy} onClick={() => onApply({ type: "color_lighter" })} />
            <QuickBtn label="Darker" disabled={busy} onClick={() => onApply({ type: "color_darker" })} />
            <QuickBtn label="Warmer" disabled={busy} onClick={() => onApply({ type: "color_warmer" })} />
            <QuickBtn label="Cooler" disabled={busy} onClick={() => onApply({ type: "color_cooler" })} />
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <TextRow
            label={roleField === "description" ? "Description" : target.field}
            value={draft}
            savedValue={currentValue}
            busy={busy}
            onChange={setDraft}
            onSave={() => onApply({ type: "set", value: draft })}
          />
          {roleSibling && (
            <TextRow
              label={roleSibling.label}
              value={siblingDraft}
              savedValue={roleSibling.value}
              busy={busy}
              onChange={setSiblingDraft}
              onSave={() => onApply({ type: "set", value: siblingDraft }, roleSibling.path)}
            />
          )}
        </div>
      )}

      {!isColor && !isMedia && (
        <div className="mt-2 space-y-1.5">
          <div className="flex flex-col gap-1">
            {suggestions.map((s) =>
              s.rewriteInstruction ? (
                <QuickBtn
                  key={s.id}
                  label={s.label}
                  block
                  disabled={busy}
                  onClick={() => applyRewrite(s.rewriteInstruction!)}
                />
              ) : null
            )}
            <div className="flex items-center gap-2 rounded-xl border border-line/40 px-2 py-1.5 focus-within:border-coral/40">
              <input
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyRewrite(customInstruction);
                    setCustomInstruction("");
                  }
                }}
                disabled={busy}
                placeholder="Or describe what you want…"
                className="min-w-0 flex-1 border-0 bg-transparent px-1 py-1 text-[11px] text-charcoal outline-none placeholder:text-warmgrey/80"
              />
              <button
                type="button"
                disabled={busy || !customInstruction.trim()}
                onClick={() => {
                  applyRewrite(customInstruction);
                  setCustomInstruction("");
                }}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-coral to-[#ff6b54] text-white disabled:opacity-40"
                aria-label="Apply custom rewrite"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
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
        </div>
      )}

      {busy && statusMessage && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-warmgrey">
          <Loader2 className="h-3 w-3 animate-spin text-coral" />
          {statusMessage}
        </p>
      )}
    </div>
  );
}

function TextRow({
  label,
  value,
  savedValue,
  busy,
  onChange,
  onSave,
}: {
  label: string;
  value: string;
  savedValue: string;
  busy?: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-warmgrey">
        {label}
      </p>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-coral/50"
          disabled={busy}
        />
        <button
          type="button"
          disabled={busy || value.trim() === savedValue.trim()}
          onClick={onSave}
          className="btn-primary !px-3 !py-2 text-xs"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function QuickBtn({
  label,
  onClick,
  disabled,
  danger,
  block,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  block?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 text-[11px] font-medium transition disabled:opacity-50 ${
        block
          ? "w-full rounded-xl border border-line/40 px-3 py-2 text-left text-charcoal hover:border-coral/35 hover:bg-cream/70"
          : danger
            ? "rounded-lg border border-red-200 px-2.5 py-1 text-red-600 hover:bg-red-50"
            : "rounded-lg border border-line px-2.5 py-1 text-charcoal hover:border-coral/40 hover:bg-cream"
      }`}
    >
      {!danger && <Wand2 className={`shrink-0 text-coral ${block ? "h-3.5 w-3.5" : "h-3 w-3"}`} />}
      {label}
    </button>
  );
}
