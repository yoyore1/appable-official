"use client";

import type { ReactNode } from "react";
import type {
  ExpoAppModel,
  ExpoCartLine,
  ExpoListItem,
  ExpoMessageThread,
  PreviewPatternId,
} from "@/lib/expoApp/types";
import type { PreviewTokens } from "@/lib/expoApp/preview/tokens";
import { CartLinesPattern } from "./patterns/CartLines";
import { CollectionListPattern } from "./patterns/CollectionList";
import { FeedScrollPattern } from "./patterns/FeedScroll";
import { InboxThreadsPattern } from "./patterns/InboxThreads";
import { ListBrowsePattern } from "./patterns/ListBrowse";
import { ShopGridPattern } from "./patterns/ShopGrid";

export function resolveTabPattern(
  model: ExpoAppModel,
  tabId: string
): PreviewPatternId {
  return (
    model.tabScreens[tabId]?.patternId ??
    model.previewPatterns?.tabs[tabId] ??
    "list-browse"
  );
}

function listVariant(
  pattern: PreviewPatternId
): "default" | "marketplace" | "booking" | "notes" {
  if (pattern === "marketplace-browse") return "marketplace";
  if (pattern === "booking-browse") return "booking";
  if (pattern === "notes-list") return "notes";
  return "default";
}

export function TabPatternView({
  model,
  tokens,
  tabId,
  threads,
  onOpenThread,
  onNewMessage,
  onOpenItem,
  onPrimaryAction,
  listsTab,
  checked,
  onToggle,
  extraItems,
  cartLines,
  editMode,
  children,
}: {
  model: ExpoAppModel;
  tokens: PreviewTokens;
  tabId: string;
  threads: ExpoMessageThread[];
  onOpenThread: (threadId: string) => void;
  onNewMessage: () => void;
  onOpenItem: (item: ExpoListItem) => void;
  onPrimaryAction?: (item: ExpoListItem) => void;
  listsTab?: boolean;
  checked?: Set<string>;
  onToggle?: (id: string) => void;
  extraItems?: ExpoListItem[];
  cartLines?: ExpoCartLine[];
  /** Tap-to-fix still uses legacy TabScreen with Selectable paths. */
  editMode?: boolean;
  children: ReactNode;
}) {
  if (editMode) return <>{children}</>;

  const screen = model.tabScreens[tabId];
  if (!screen) return <>{children}</>;

  const pattern = resolveTabPattern(model, tabId);
  const category = model.category;
  const items = [...screen.items, ...(extraItems ?? [])];

  if (pattern === "inbox-threads") {
    return (
      <InboxThreadsPattern
        tokens={tokens}
        title={screen.title}
        subtitle={screen.subtitle}
        threads={threads}
        category={category}
        onOpenThread={onOpenThread}
        onNewMessage={onNewMessage}
      />
    );
  }

  if (pattern === "cart-lines" || pattern === "checkout-summary") {
    const lines = cartLines ?? model.previewState?.cart ?? [];
    return (
      <CartLinesPattern
        tokens={tokens}
        title={screen.title}
        subtitle={screen.subtitle}
        lines={lines}
        category={category}
        onCheckout={() => {
          const first = items[0] ?? screen.items[0];
          if (first) onPrimaryAction?.(first);
        }}
      />
    );
  }

  if (pattern === "shop-grid") {
    return (
      <ShopGridPattern
        tokens={tokens}
        title={screen.title}
        subtitle={screen.subtitle}
        items={items}
        category={category}
        onOpen={onOpenItem}
        onPrimaryAction={onPrimaryAction}
      />
    );
  }

  if (pattern === "feed-scroll") {
    return (
      <FeedScrollPattern
        tokens={tokens}
        title={screen.title}
        subtitle={screen.subtitle}
        items={items}
        category={category}
        onOpen={onOpenItem}
      />
    );
  }

  if (pattern === "collection-list" || pattern === "habit-checklist") {
    return (
      <CollectionListPattern
        tokens={tokens}
        title={screen.title}
        subtitle={screen.subtitle}
        items={items}
        checked={checked ?? new Set()}
        onToggle={onToggle ?? (() => {})}
        onOpen={onOpenItem}
      />
    );
  }

  if (
    pattern === "list-browse" ||
    pattern === "marketplace-browse" ||
    pattern === "booking-browse" ||
    pattern === "notes-list"
  ) {
    return (
      <ListBrowsePattern
        tokens={tokens}
        title={screen.title}
        subtitle={screen.subtitle}
        items={items}
        category={category}
        variant={listVariant(pattern)}
        onOpen={onOpenItem}
        onPrimaryAction={onPrimaryAction}
      />
    );
  }

  return (
    <ListBrowsePattern
      tokens={tokens}
      title={screen.title}
      subtitle={screen.subtitle}
      items={items}
      category={category}
      onOpen={onOpenItem}
      onPrimaryAction={onPrimaryAction}
    />
  );
}
