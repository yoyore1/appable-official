"use client";

import type { ExpoListItem } from "@/lib/expoApp/types";
import type { PreviewTokens } from "@/lib/expoApp/preview/tokens";
import { ScreenHeader } from "../primitives";
import { PreviewCoverImage } from "../PreviewCoverImage";

export function FeedScrollPattern({
  tokens,
  title,
  subtitle,
  items,
  category,
  onOpen,
}: {
  tokens: PreviewTokens;
  title: string;
  subtitle: string;
  items: ExpoListItem[];
  category: string;
  onOpen: (item: ExpoListItem) => void;
}) {
  return (
    <div className="h-full overflow-y-auto pb-2">
      <ScreenHeader tokens={tokens} title={title} subtitle={subtitle} />
      <div className="mt-2 space-y-2">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className="w-full overflow-hidden rounded-xl border text-left"
            style={{ borderColor: tokens.line, background: tokens.card, boxShadow: tokens.shadowCard }}
          >
            <PreviewCoverImage
              src={item.imageUrl}
              category={category}
              fallbackIndex={i}
              className="aspect-[16/9] w-full object-cover"
            />
            <div className="p-2.5">
              <p className="text-[10px] font-bold" style={{ color: tokens.charcoal }}>
                {item.title}
              </p>
              <p className="mt-0.5 text-[9px] leading-snug" style={{ color: tokens.muted }}>
                {item.subtitle}
              </p>
              {item.meta && (
                <p className="mt-1 text-[8px] font-medium" style={{ color: tokens.accent }}>
                  {item.meta}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
