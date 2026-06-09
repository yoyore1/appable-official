"use client";

import { Check } from "lucide-react";
import type { ExpoListItem } from "@/lib/expoApp/types";
import type { PreviewTokens } from "@/lib/expoApp/preview/tokens";
import { ScreenHeader } from "../primitives";

export function CollectionListPattern({
  tokens,
  title,
  subtitle,
  items,
  checked,
  onToggle,
  onOpen,
}: {
  tokens: PreviewTokens;
  title: string;
  subtitle: string;
  items: ExpoListItem[];
  checked: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (item: ExpoListItem) => void;
}) {
  return (
    <div className="h-full overflow-y-auto pb-2">
      <ScreenHeader tokens={tokens} title={title} subtitle={subtitle} />
      <div className="mt-2 space-y-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 rounded-xl border p-2"
            style={{ borderColor: tokens.line, background: tokens.card }}
          >
            <button
              type="button"
              onClick={() => onToggle(item.id)}
              className="grid h-5 w-5 shrink-0 place-items-center rounded-md border"
              style={{
                borderColor: checked.has(item.id) ? tokens.accent : tokens.line,
                background: checked.has(item.id) ? tokens.accent : "transparent",
                minHeight: 44,
                minWidth: 44,
              }}
              aria-label={checked.has(item.id) ? "Uncheck" : "Check"}
            >
              {checked.has(item.id) && <Check className="h-3 w-3 text-white" />}
            </button>
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block text-[10px] font-bold" style={{ color: tokens.charcoal }}>
                {item.title}
              </span>
              <span className="block text-[9px]" style={{ color: tokens.muted }}>
                {item.subtitle}
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
