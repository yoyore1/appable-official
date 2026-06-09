"use client";

import { Loader2, Share2, Volume2, X } from "lucide-react";
import type { ExpoListItem } from "@/lib/expoApp/types";
import type { PreviewTokens } from "@/lib/expoApp/preview/tokens";
import { PrimaryButton, SecondaryButton } from "../primitives";
import { PreviewCoverImage } from "../PreviewCoverImage";

export function ContentDetailPattern({
  tokens,
  item,
  category,
  onClose,
  onListen,
  listenBusy,
  onSave,
  isSaved,
  onAddToList,
  onShare,
  onPrimaryAction,
  collectionLabel = "Add to collection",
}: {
  tokens: PreviewTokens;
  item: ExpoListItem;
  category: string;
  onClose: () => void;
  onListen?: () => void;
  listenBusy?: boolean;
  onSave?: () => void;
  isSaved?: boolean;
  onAddToList?: () => void;
  onShare?: () => void;
  onPrimaryAction?: () => void;
  collectionLabel?: string;
}) {
  const isRecipe = item.detailType === "recipe";

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col justify-end bg-charcoal/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[80%] overflow-y-auto rounded-t-2xl p-3"
        style={{ background: tokens.card }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <p
            className="text-[11px] font-bold"
            style={{ color: tokens.charcoal, fontFamily: `var(--font-display), Georgia, serif` }}
          >
            {isRecipe ? "Recipe" : "Details"}
          </p>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" style={{ color: tokens.muted }} />
          </button>
        </div>

        <PreviewCoverImage
          src={item.imageUrl}
          category={category}
          className="mb-2 h-28 w-full rounded-xl object-cover"
        />

        <p className="text-[12px] font-extrabold leading-tight" style={{ color: tokens.charcoal }}>
          {item.title}
        </p>
        <p className="mt-1 text-[10px] leading-relaxed" style={{ color: tokens.muted }}>
          {item.subtitle}
        </p>
        {item.meta && (
          <p className="mt-1 text-[10px] font-semibold" style={{ color: tokens.accent }}>
            {item.meta}
          </p>
        )}
        {item.body && (
          <p className="mt-2 text-[10px] leading-relaxed" style={{ color: tokens.charcoal }}>
            {item.body}
          </p>
        )}

        {item.ingredients && item.ingredients.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: tokens.muted }}>
              Ingredients
            </p>
            <ul className="space-y-0.5">
              {item.ingredients.map((ing) => (
                <li key={ing} className="text-[9px]" style={{ color: tokens.charcoal }}>
                  · {ing}
                </li>
              ))}
            </ul>
          </div>
        )}

        {item.steps && item.steps.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: tokens.muted }}>
              Steps
            </p>
            <ol className="space-y-1">
              {item.steps.map((step, i) => (
                <li key={step} className="text-[9px] leading-snug" style={{ color: tokens.charcoal }}>
                  <span className="font-bold" style={{ color: tokens.accent }}>
                    {i + 1}.{" "}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-1.5">
          {onPrimaryAction && item.primaryAction && (
            <PrimaryButton tokens={tokens} onClick={onPrimaryAction}>
              {item.primaryAction}
            </PrimaryButton>
          )}
          {onAddToList && (
            <SecondaryButton tokens={tokens} onClick={onAddToList}>
              {collectionLabel}
            </SecondaryButton>
          )}
          <div className="flex gap-1.5">
            {onSave && (
              <SecondaryButton tokens={tokens} onClick={onSave}>
                {isSaved ? "Saved" : "Save"}
              </SecondaryButton>
            )}
            {onShare && (
              <button
                type="button"
                onClick={onShare}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border py-2 text-[9px] font-bold"
                style={{ borderColor: tokens.line, color: tokens.charcoal }}
              >
                <Share2 className="h-3 w-3" />
                Share
              </button>
            )}
            {onListen && (
              <button
                type="button"
                onClick={onListen}
                disabled={listenBusy}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl border py-2 text-[9px] font-bold disabled:opacity-50"
                style={{ borderColor: tokens.line, color: tokens.charcoal }}
              >
                {listenBusy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Volume2 className="h-3 w-3" />
                )}
                Listen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
