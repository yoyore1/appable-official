import type { MasterBuildPrompt } from "@/lib/types";
import { resolveMessagesTab } from "./builtState";
import { assignPreviewPatterns } from "./preview/assignPatterns";
import { listItemsToThreads } from "./preview/patterns/messagingData";
import type { ExpoAppModel, ExpoListItem, PreviewActionPlan } from "./types";

export function wantsMessagingBackendWork(message: string): boolean {
  const m = message.toLowerCase();
  if (/read receipt/.test(m)) return false;
  return (
    (/messag|chat|inbox|conversation|sender_id|thread/.test(m) &&
      /table|schema|database|supabase|wire|add|create|build|preview|tab|ui|list|field|column|live|implement/.test(
        m
      )) ||
    (/messag|chat|inbox/.test(m) && /wire|hook up|set up|enable|build/.test(m)) ||
    (/build|wire|implement|create/.test(m) && /messag|chat|inbox|conversation/.test(m))
  );
}

export function wantsAuthPreviewWork(message: string): boolean {
  const m = message.toLowerCase();
  if (wantsMessagingBackendWork(message)) return false;
  return (
    /supabase|firebase|auth|sign[\s-]?up|sign[\s-]?in|log[\s-]?in|create a user|has_completed_onboarding|onboarding flag|account|register/.test(
      m
    )
  );
}

function sampleThreads(appName: string): ExpoListItem[] {
  return [
    {
      id: "thread-sam",
      title: "Sam · Golden Retriever walk",
      subtitle: "Can we do Saturday 9am?",
      meta: "2h ago",
      badge: "New",
      imageUrl: "",
      primaryAction: "Reply",
      detailType: "article",
      body: "Hey! Confirming the Saturday morning walk — I'll bring treats.",
    },
    {
      id: "thread-jordan",
      title: "Jordan · Lab mix",
      subtitle: "On my way — 5 min out",
      meta: "Yesterday",
      imageUrl: "",
      primaryAction: "Reply",
      detailType: "article",
      body: "Running a few minutes late — traffic on Main St.",
    },
    {
      id: "thread-new",
      title: "New conversation",
      subtitle: `Coordinate walks inside ${appName}`,
      meta: "Tap to start",
      imageUrl: "",
      primaryAction: "Message",
      detailType: "generic",
    },
  ];
}

/** Wire Messages tab + compose flow in the web preview. */
export function wireMessagingInPreview(
  model: ExpoAppModel,
  mp: MasterBuildPrompt
): { model: ExpoAppModel; reply: string } {
  const alreadyWired =
    Boolean(model.previewActions?.messagingTabId) &&
    Boolean(model.tabScreens[model.previewActions!.messagingTabId!]?.items?.length);

  const { tabs, tabId: messagesTabId } = resolveMessagesTab(model.tabs);
  const addedTab = tabs.length > model.tabs.length;

  const threads = sampleThreads(mp.appName).map((item) => ({
    ...item,
    imageUrl: item.imageUrl || "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=200&h=200&fit=crop",
  }));

  const tabScreens = {
    ...model.tabScreens,
    [messagesTabId]: {
      title: "Messages",
      subtitle: "Chat to confirm walk details — delivered when it hits their inbox.",
      items: threads,
    },
  };

  const rules: PreviewActionPlan["rules"] = [
    ...(model.previewActions?.rules ?? []).filter(
      (r) => !/message|reply|chat/i.test(r.match)
    ),
    {
      match: "message",
      kind: "compose_message",
      toast: "Message sent",
      composeTitle: "New message",
    },
    {
      match: "reply",
      kind: "compose_message",
      toast: "Reply sent",
      composeTitle: "Reply",
    },
  ];

  const threadData = listItemsToThreads(threads);
  const next: ExpoAppModel = assignPreviewPatterns(
    {
      ...model,
      tabs,
      tabScreens,
      previewActions: {
        ...model.previewActions,
        messagingTabId: messagesTabId,
        rules,
      },
      previewState: {
        ...model.previewState,
        threads: threadData,
      },
    },
    mp,
    []
  );

  const tabNote = addedTab
    ? " Added a Messages tab without removing your other tabs."
    : " Reused your existing messages/alerts tab.";

  return {
    model: next,
    reply: alreadyWired
      ? "Messages is already wired — sample threads and compose are live. Say what to change (copy, more threads, etc.)."
      : `Done — Messages tab is in the preview with sample threads and compose/reply.${tabNote} ` +
        "Backend uses conversations + messages (sender_id, text) — no read receipts for v1.",
  };
}
