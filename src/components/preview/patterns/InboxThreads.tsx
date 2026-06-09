"use client";

import type { ExpoMessageThread } from "@/lib/expoApp/types";
import type { PreviewTokens } from "@/lib/expoApp/preview/tokens";
import { EmptyState, ScreenHeader, ThreadRow } from "../primitives";

export function InboxThreadsPattern({
  tokens,
  title,
  subtitle,
  threads,
  category,
  onOpenThread,
  onNewMessage,
}: {
  tokens: PreviewTokens;
  title: string;
  subtitle: string;
  threads: ExpoMessageThread[];
  category: string;
  onOpenThread: (threadId: string) => void;
  onNewMessage: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto pb-2">
      <ScreenHeader
        tokens={tokens}
        title={title}
        subtitle={subtitle}
        trailing={
          <button
            type="button"
            onClick={onNewMessage}
            className="shrink-0 rounded-lg px-2 py-1 text-[9px] font-bold text-white"
            style={{ background: tokens.accent }}
          >
            New
          </button>
        }
      />
      <div className="mt-2 space-y-1.5">
        {threads.length === 0 ? (
          <EmptyState
            tokens={tokens}
            title="No messages yet"
            body="Start a conversation to coordinate details."
            actionLabel="New message"
            onAction={onNewMessage}
          />
        ) : (
          threads.map((t, i) => (
            <ThreadRow
              key={t.id}
              tokens={tokens}
              participant={t.participant}
              preview={t.preview}
              time={t.time}
              unread={t.unread}
              avatarUrl={t.participantAvatar}
              category={category}
              index={i}
              onPress={() => onOpenThread(t.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
