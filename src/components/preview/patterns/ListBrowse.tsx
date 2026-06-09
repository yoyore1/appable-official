"use client";

import { ChevronRight } from "lucide-react";
import type { ExpoListItem } from "@/lib/expoApp/types";
import type { PreviewTokens } from "@/lib/expoApp/preview/tokens";
import { PrimaryButton, ScreenHeader, StatusChip } from "../primitives";
import { PreviewCoverImage } from "../PreviewCoverImage";

export type ListBrowseVariant = "default" | "marketplace" | "booking" | "notes";

export function ListBrowsePattern({
  tokens,
  title,
  subtitle,
  items,
  category,
  variant = "default",
  onOpen,
  onPrimaryAction,
}: {
  tokens: PreviewTokens;
  title: string;
  subtitle: string;
  items: ExpoListItem[];
  category: string;
  variant?: ListBrowseVariant;
  onOpen: (item: ExpoListItem) => void;
  onPrimaryAction?: (item: ExpoListItem) => void;
}) {
  return (
    <div className="h-full overflow-y-auto pb-2">
      <ScreenHeader tokens={tokens} title={title} subtitle={subtitle} />
      <div className="mt-2 space-y-1.5">
        {items.map((item, i) => (
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
                  {(variant === "marketplace" || variant === "booking") && item.badge && (
                    <StatusChip tokens={tokens} label={item.badge} />
                  )}
                  {(item.tags ?? []).slice(0, 2).map((tag) => (
                    <StatusChip key={tag} tokens={tokens} label={tag} />
                  ))}
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
  );
}
