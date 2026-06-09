"use client";

import type { ExpoListItem } from "@/lib/expoApp/types";
import type { PreviewTokens } from "@/lib/expoApp/preview/tokens";
import { ScreenHeader } from "../primitives";
import { PreviewCoverImage } from "../PreviewCoverImage";

export function ShopGridPattern({
  tokens,
  title,
  subtitle,
  items,
  category,
  onOpen,
  onPrimaryAction,
}: {
  tokens: PreviewTokens;
  title: string;
  subtitle: string;
  items: ExpoListItem[];
  category: string;
  onOpen: (item: ExpoListItem) => void;
  onPrimaryAction?: (item: ExpoListItem) => void;
}) {
  return (
    <div className="h-full overflow-y-auto pb-2">
      <ScreenHeader tokens={tokens} title={title} subtitle={subtitle} />
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className="overflow-hidden rounded-xl border text-left"
            style={{ borderColor: tokens.line, background: tokens.card }}
          >
            <PreviewCoverImage
              src={item.imageUrl}
              category={category}
              fallbackIndex={i}
              className="aspect-square w-full object-cover"
            />
            <div className="p-2">
              <p className="line-clamp-2 text-[9px] font-bold" style={{ color: tokens.charcoal }}>
                {item.title}
              </p>
              {item.meta && (
                <p className="mt-0.5 text-[9px] font-bold" style={{ color: tokens.accent }}>
                  {item.meta}
                </p>
              )}
              {item.primaryAction && onPrimaryAction && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPrimaryAction(item);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      onPrimaryAction(item);
                    }
                  }}
                  className="mt-1.5 block text-[8px] font-bold"
                  style={{ color: tokens.accent }}
                >
                  {item.primaryAction}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
