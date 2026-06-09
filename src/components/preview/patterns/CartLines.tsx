"use client";

import type { ExpoCartLine } from "@/lib/expoApp/types";
import type { PreviewTokens } from "@/lib/expoApp/preview/tokens";
import { EmptyState, PrimaryButton, ScreenHeader } from "../primitives";
import { PreviewCoverImage } from "../PreviewCoverImage";

export function CartLinesPattern({
  tokens,
  title,
  subtitle,
  lines,
  category,
  onCheckout,
}: {
  tokens: PreviewTokens;
  title: string;
  subtitle: string;
  lines: ExpoCartLine[];
  category: string;
  onCheckout?: () => void;
}) {
  const total = lines.reduce((sum, l) => {
    const n = parseFloat(l.price.replace(/[^0-9.]/g, "")) || 0;
    return sum + n * l.qty;
  }, 0);

  return (
    <div className="h-full overflow-y-auto pb-2">
      <ScreenHeader tokens={tokens} title={title} subtitle={subtitle} />
      {lines.length === 0 ? (
        <EmptyState
          tokens={tokens}
          title="Cart is empty"
          body="Add items from the shop tab to try checkout in the preview."
        />
      ) : (
        <>
          <div className="mt-2 space-y-1.5">
            {lines.map((line, i) => (
              <div
                key={line.id}
                className="flex items-center gap-2 rounded-xl border p-2"
                style={{ borderColor: tokens.line, background: tokens.card }}
              >
                <PreviewCoverImage
                  src={line.imageUrl}
                  category={category}
                  fallbackIndex={i}
                  className="h-11 w-11 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold" style={{ color: tokens.charcoal }}>
                    {line.title}
                  </p>
                  <p className="text-[9px]" style={{ color: tokens.muted }}>
                    Qty {line.qty}
                  </p>
                </div>
                <p className="text-[10px] font-bold" style={{ color: tokens.accent }}>
                  {line.price}
                </p>
              </div>
            ))}
          </div>
          <div
            className="mt-3 rounded-xl border p-2.5"
            style={{ borderColor: tokens.line, background: tokens.card }}
          >
            <div className="flex justify-between text-[10px] font-bold">
              <span style={{ color: tokens.charcoal }}>Total</span>
              <span style={{ color: tokens.accent }}>${total.toFixed(2)}</span>
            </div>
            {onCheckout && (
              <PrimaryButton tokens={tokens} onClick={onCheckout} className="mt-2">
                Checkout
              </PrimaryButton>
            )}
          </div>
        </>
      )}
    </div>
  );
}
