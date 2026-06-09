import type { ExpoListItem, ExpoMessageThread, ExpoThreadMessage } from "../../types";

function participantFromTitle(title: string): string {
  const part = title.split("·")[0]?.trim() ?? title;
  return part.replace(/^new conversation$/i, "New chat");
}

function seedMessages(item: ExpoListItem): ExpoThreadMessage[] {
  const participant = participantFromTitle(item.title);
  const msgs: ExpoThreadMessage[] = [];
  if (item.body?.trim()) {
    msgs.push({
      id: `${item.id}-m0`,
      sender: "them",
      senderLabel: participant,
      text: item.body.trim(),
      at: item.meta ?? "Earlier",
    });
  } else if (item.subtitle?.trim()) {
    msgs.push({
      id: `${item.id}-m0`,
      sender: "them",
      senderLabel: participant,
      text: item.subtitle.trim(),
      at: item.meta ?? "Earlier",
    });
  }
  return msgs;
}

export function listItemsToThreads(items: ExpoListItem[]): ExpoMessageThread[] {
  return items
    .filter((it) => !/^new conversation$/i.test(it.title.trim()))
    .map((item) => {
      const participant = participantFromTitle(item.title);
      return {
        id: item.id,
        participant,
        participantAvatar: item.imageUrl || undefined,
        preview: item.subtitle,
        time: item.meta ?? "",
        unread: /new/i.test(item.badge ?? ""),
        messages: seedMessages(item),
      };
    });
}

export function threadsToListItems(threads: ExpoMessageThread[]): ExpoListItem[] {
  return threads.map((t) => ({
    id: t.id,
    title: t.participant,
    subtitle: t.preview,
    meta: t.time,
    badge: t.unread ? "New" : undefined,
    imageUrl: t.participantAvatar ?? "",
    primaryAction: "Reply",
    detailType: "generic" as const,
  }));
}

export function appendThreadMessage(
  threads: ExpoMessageThread[],
  threadId: string,
  text: string,
  sender: "me" | "them" = "me"
): ExpoMessageThread[] {
  const trimmed = text.trim();
  if (!trimmed) return threads;

  return threads.map((t) => {
    if (t.id !== threadId) return t;
    const msg: ExpoThreadMessage = {
      id: `msg-${Date.now()}`,
      sender,
      senderLabel: sender === "me" ? "You" : t.participant,
      text: trimmed,
      at: "Just now",
    };
    return {
      ...t,
      preview: trimmed.length > 48 ? `${trimmed.slice(0, 45)}…` : trimmed,
      time: "Just now",
      unread: false,
      messages: [...t.messages, msg],
    };
  });
}

export function createThreadFromCompose(
  threads: ExpoMessageThread[],
  text: string,
  participant = "New contact"
): ExpoMessageThread[] {
  const id = `thread-${Date.now()}`;
  const thread: ExpoMessageThread = {
    id,
    participant,
    preview: text.trim(),
    time: "Just now",
    messages: [
      {
        id: `msg-${Date.now()}`,
        sender: "me",
        senderLabel: "You",
        text: text.trim(),
        at: "Just now",
      },
    ],
  };
  return [thread, ...threads];
}
