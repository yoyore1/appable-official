"use client";

import { ChevronLeft } from "lucide-react";
import type { ExpoMessageThread } from "@/lib/expoApp/types";
import type { PreviewTokens } from "@/lib/expoApp/preview/tokens";
import { MessageBubble, PrimaryButton } from "../primitives";
import { PreviewCoverImage } from "../PreviewCoverImage";

export function ConversationView({
  tokens,
  thread,
  category,
  onBack,
  onReply,
}: {
  tokens: PreviewTokens;
  thread: ExpoMessageThread;
  category: string;
  onBack: () => void;
  onReply: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-[35] flex flex-col"
      style={{ background: tokens.cream }}
    >
      <div
        className="flex items-center gap-2 border-b px-2 py-2"
        style={{ borderColor: tokens.line, background: tokens.card }}
      >
        <button type="button" onClick={onBack} className="grid h-8 w-8 place-items-center" aria-label="Back">
          <ChevronLeft className="h-4 w-4" style={{ color: tokens.charcoal }} />
        </button>
        <PreviewCoverImage
          src={thread.participantAvatar ?? ""}
          category={category}
          className="h-8 w-8 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold" style={{ color: tokens.charcoal }}>
            {thread.participant}
          </p>
          <p className="text-[8px]" style={{ color: tokens.muted }}>
            Active now
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-2 py-3">
        {thread.messages.map((m) => (
          <MessageBubble
            key={m.id}
            tokens={tokens}
            text={m.text}
            sent={m.sender === "me"}
            senderLabel={m.senderLabel}
            at={m.at}
          />
        ))}
      </div>

      <div className="border-t p-2" style={{ borderColor: tokens.line, background: tokens.card }}>
        <PrimaryButton tokens={tokens} onClick={onReply}>
          Reply
        </PrimaryButton>
      </div>
    </div>
  );
}
