"use client";

import { Camera, ChevronRight, Mic } from "lucide-react";
import type { ExpoHomeSection, ExpoListItem } from "@/lib/expoApp/types";
import type { PreviewTokens } from "@/lib/expoApp/preview/tokens";
import { PrimaryButton, StatusChip } from "../primitives";
import { PreviewCoverImage } from "../PreviewCoverImage";

export function HomeDashboardPattern({
  tokens,
  headline,
  subheadline,
  heroLabel,
  heroSublabel,
  sections,
  category,
  onOpen,
  onHero,
  onPrimaryAction,
  hasScan,
  onVoice,
  scanning,
  recording,
}: {
  tokens: PreviewTokens;
  headline: string;
  subheadline: string;
  heroLabel: string;
  heroSublabel: string;
  sections: ExpoHomeSection[];
  category: string;
  onOpen: (item: ExpoListItem) => void;
  onHero: () => void;
  onPrimaryAction?: (item: ExpoListItem) => void;
  hasScan?: boolean;
  onVoice?: () => void;
  scanning?: boolean;
  recording?: boolean;
}) {
  return (
    <div className="h-full overflow-y-auto pb-2">
      <p
        className="text-[12px] font-extrabold leading-tight"
        style={{ color: tokens.charcoal, fontFamily: `var(--font-display), Georgia, serif` }}
      >
        {headline}
      </p>
      <p className="mt-0.5 text-[10px] leading-snug" style={{ color: tokens.muted }}>
        {subheadline}
      </p>

      <button
        type="button"
        onClick={onHero}
        className="mt-2.5 flex w-full items-center gap-2 rounded-2xl p-2.5 text-left"
        style={{ background: tokens.accent, boxShadow: tokens.shadowCard, borderRadius: tokens.radiusLg }}
      >
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/20">
          {hasScan ? (
            <Camera className="h-4 w-4 text-white" />
          ) : (
            <ChevronRight className="h-4 w-4 text-white" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[9px] font-bold text-white">{heroLabel}</span>
          <span className="block truncate text-[9px] text-white/85">
            {scanning ? "Analyzing with AI vision…" : heroSublabel}
          </span>
        </span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/80" />
      </button>

      {onVoice && (
        <button
          type="button"
          onClick={onVoice}
          className="mt-1.5 flex w-full items-center gap-2 rounded-2xl border p-2 text-left"
          style={{ borderColor: tokens.line, background: tokens.card, borderRadius: tokens.radiusLg }}
        >
          <span
            className="grid h-7 w-7 place-items-center rounded-xl"
            style={{ background: `${tokens.accent}18` }}
          >
            <Mic className="h-3.5 w-3.5" style={{ color: tokens.accent }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold" style={{ color: tokens.charcoal }}>
              {recording ? "Listening…" : "Voice note"}
            </span>
            <span className="block text-[9px]" style={{ color: tokens.muted }}>
              Hold mic — real speech-to-text
            </span>
          </span>
        </button>
      )}

      {sections.map((sec) => (
        <div key={sec.title} className="mt-3">
          <p
            className="mb-1.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ color: tokens.muted }}
          >
            {sec.title}
          </p>
          <div className="space-y-1.5">
            {sec.items.map((item, i) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-xl border"
                style={{
                  borderColor: tokens.line,
                  background: tokens.card,
                  boxShadow: tokens.shadowCard,
                  borderRadius: tokens.radiusLg,
                }}
              >
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className="flex w-full items-center gap-2.5 p-2.5 text-left"
                  style={{ minHeight: 44 }}
                >
                  <PreviewCoverImage
                    src={item.imageUrl}
                    category={category}
                    fallbackIndex={i}
                    className="h-11 w-11 shrink-0 rounded-xl object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1">
                      {(item.tags ?? []).slice(0, 2).map((tag) => (
                        <StatusChip key={tag} tokens={tokens} label={tag} />
                      ))}
                      {item.badge && <StatusChip tokens={tokens} label={item.badge} />}
                    </span>
                    <span
                      className="mt-0.5 block text-[10px] font-bold leading-tight"
                      style={{ color: tokens.charcoal }}
                    >
                      {item.title}
                    </span>
                    <span
                      className="mt-0.5 block text-[9px] leading-snug line-clamp-2"
                      style={{ color: tokens.muted }}
                    >
                      {item.subtitle}
                    </span>
                    {item.meta && (
                      <span
                        className="mt-0.5 block text-[8px] font-semibold"
                        style={{ color: tokens.accent }}
                      >
                        {item.meta}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: tokens.muted }} />
                </button>
                {item.primaryAction && onPrimaryAction && (
                  <div className="border-t px-2.5 py-2" style={{ borderColor: tokens.line }}>
                    <PrimaryButton
                      tokens={tokens}
                      onClick={() => onPrimaryAction(item)}
                      className="py-2 text-[9px]"
                    >
                      {item.primaryAction}
                    </PrimaryButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
