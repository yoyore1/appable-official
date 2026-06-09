"use client";

import { useRef, useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import {
  attachChatFiles,
  MAX_CHAT_ATTACHMENTS,
  type PendingChatAttachment,
} from "@/lib/expoApp/chatAttachments";

export function ChatAttachButton({
  disabled,
  count,
  onAttach,
  onError,
}: {
  disabled?: boolean;
  count: number;
  onAttach: (attachment: PendingChatAttachment) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length || disabled || reading) return;
    if (count >= MAX_CHAT_ATTACHMENTS) {
      onError(`Max ${MAX_CHAT_ATTACHMENTS} attachments.`);
      return;
    }

    setReading(true);
    try {
      await attachChatFiles(Array.from(files), { currentCount: count, onAttach, onError });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not attach file.");
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,.txt,.md,.markdown,.csv,.json,.xml,.html,text/plain,text/markdown,text/csv,application/json"
        multiple
        className="hidden"
        onChange={(e) => void onFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={disabled || reading || count >= MAX_CHAT_ATTACHMENTS}
        onClick={() => inputRef.current?.click()}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-warmgrey transition hover:bg-sand/70 hover:text-charcoal disabled:opacity-40"
        aria-label="Attach photo or file"
        title="Attach photo or file — or paste an image (Ctrl+V)"
      >
        {reading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
      </button>
    </>
  );
}
