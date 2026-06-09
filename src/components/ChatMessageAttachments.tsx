"use client";

import { FileText, X } from "lucide-react";
import type { ChatAttachmentRef } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ChatMessageAttachments({
  attachments,
  variant = "user",
  onRemove,
}: {
  attachments: ChatAttachmentRef[];
  variant?: "user" | "pending";
  onRemove?: (index: number) => void;
}) {
  if (!attachments.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", onRemove ? "mb-1.5" : "mt-2")}>
      {attachments.map((att, i) => (
        <div
          key={`${att.name}-${i}`}
          className={cn(
            "relative flex items-center gap-1.5 rounded-lg border px-1.5 py-1 text-[10px]",
            variant === "user"
              ? "border-white/25 bg-white/15 text-white"
              : "border-line/40 bg-cream/60 text-charcoal-soft"
          )}
        >
          {att.kind === "image" && att.thumbDataUrl ? (
            <img
              src={att.thumbDataUrl}
              alt=""
              className="h-8 w-8 rounded object-cover"
            />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded bg-white/20">
              <FileText className="h-3.5 w-3.5" />
            </span>
          )}
          <span className="max-w-[88px] truncate font-medium">{att.name}</span>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="ml-0.5 grid h-5 w-5 place-items-center rounded-full hover:bg-black/10"
              aria-label={`Remove ${att.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
