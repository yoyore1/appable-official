import type {
  InterviewTurn,
  MasterBuildPrompt,
  ProjectReadinessState,
  ReadinessDecision,
  ReadinessItemState,
} from "@/lib/types";
import { buildInterviewContext } from "./interviewContext";
import type { ExpoAppModel } from "./types";

export type ReadinessCategory =
  | "screens"
  | "auth"
  | "backend"
  | "onboarding"
  | "payments"
  | "messaging"
  | "legal"
  | "growth";

export type ReadinessStatus = "have" | "partial" | "missing";

export type ReadinessPriority = "launch_blocker" | "soon" | "nice_to_have";

export interface ReadinessItem {
  id: string;
  category: ReadinessCategory;
  title: string;
  status: ReadinessStatus;
  plainWhy: string;
  inPreview: boolean;
  priority: ReadinessPriority;
  /** Merged from persisted project state (Phase 2). */
  userState?: ReadinessItemState;
  pinned?: boolean;
}

export interface AppReadinessAudit {
  appName: string;
  category: string;
  items: ReadinessItem[];
  haveCount: number;
  partialCount: number;
  missingCount: number;
  discussedCount: number;
  launchBlockers: ReadinessItem[];
  topGaps: ReadinessItem[];
}

/** One-tap next step above chat — label on pill, prompt in input. */
export interface ReadinessSuggestion {
  id: string;
  label: string;
  prompt: string;
  itemId: string;
  step: number;
}

export type { ReadinessDecision, ReadinessItemState, ProjectReadinessState };

/** Attach saved progress + pinned row to a fresh audit (re-runs after Build tweaks). */
export function enrichAuditWithState(
  audit: AppReadinessAudit,
  state: ProjectReadinessState | null | undefined,
  pinnedItemId?: string | null
): AppReadinessAudit {
  const items = audit.items.map((item) => ({
    ...item,
    userState: state?.items[item.id],
    pinned: pinnedItemId != null && pinnedItemId === item.id,
  }));
  const discussedCount = items.filter((i) => i.userState?.discussed).length;
  return { ...audit, items, discussedCount };
}

export function defaultReadinessState(): ProjectReadinessState {
  return { items: {}, pinnedItemId: null };
}

export function patchReadinessItem(
  state: ProjectReadinessState,
  itemId: string,
  patch: Partial<ReadinessItemState>
): ProjectReadinessState {
  const prev = state.items[itemId] ?? { discussed: false, decision: null };
  return {
    ...state,
    items: {
      ...state.items,
      [itemId]: {
        ...prev,
        ...patch,
        discussedAt: patch.discussed ? new Date().toISOString() : prev.discussedAt,
      },
    },
  };
}

function blobFrom(mp: MasterBuildPrompt, interview: InterviewTurn[]): string {
  return buildInterviewContext(mp, interview).transcript.toLowerCase();
}

function hasInText(text: string, re: RegExp): boolean {
  return re.test(text);
}

function modelHasMessagingTab(model: ExpoAppModel): boolean {
  return model.tabs.some((t) => /message|chat|inbox/i.test(`${t.id} ${t.label}`));
}

function modelHasPaymentsUi(model: ExpoAppModel): boolean {
  const scan = JSON.stringify({
    home: model.home,
    tabs: model.tabs,
    screens: model.tabScreens,
    profile: model.profile,
  }).toLowerCase();
  return /pay|subscribe|premium|pro\b|checkout|price|\$/.test(scan);
}

function profileHasLegalRow(model: ExpoAppModel): boolean {
  return model.profile.settings.some((s) =>
    /privacy|terms|legal|policy/i.test(s.label)
  );
}

function countListItems(model: ExpoAppModel): number {
  let n = 0;
  for (const sec of model.home.sections) n += sec.items.length;
  for (const screen of Object.values(model.tabScreens)) n += screen.items.length;
  return n;
}

function essentialLooksCovered(essential: string, model: ExpoAppModel, blob: string): boolean {
  const e = essential.toLowerCase();
  const modelBlob = JSON.stringify(model).toLowerCase();
  if (/message|chat|inbox/.test(e)) return modelHasMessagingTab(model);
  if (/pay|budget|\$|subscribe/.test(e)) {
    return modelHasPaymentsUi(model) || hasInText(blob, /pay|subscription|stripe|revenue/);
  }
  if (/profile|rating|review/.test(e)) {
    return hasInText(modelBlob, /rating|review|profile/) || model.flow?.roles != null;
  }
  if (/save|favorite|bookmark/.test(e)) {
    return (
      model.capabilities.uiFeatures?.some((f) => /save|favorite|collection/i.test(f)) ??
      hasInText(modelBlob, /save|favorite|bookmark/)
    );
  }
  if (/remind|notification/.test(e)) {
    return hasInText(blob, /push|notification|remind/);
  }
  if (/onboard/.test(e)) return model.onboarding.length > 0;
  const hint = e.split(/\s+/).slice(0, 2).join(" ");
  return hint.length > 2 && modelBlob.includes(hint);
}

function push(
  items: ReadinessItem[],
  item: Omit<ReadinessItem, "id"> & { id?: string }
) {
  items.push({ ...item, id: item.id ?? `${item.category}-${items.length}` });
}

/** Deterministic “what you have vs what’s missing” for post-build brainstorm. */
export function auditAppReadiness(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): AppReadinessAudit {
  const ctx = buildInterviewContext(mp, interview);
  const blob = blobFrom(mp, interview);
  const items: ReadinessItem[] = [];
  const itemCount = countListItems(model);
  const dualSided = Boolean(model.flow?.roles?.length);

  const screensStatus: ReadinessStatus =
    model.tabs.length >= 2 && itemCount >= 3
      ? "have"
      : model.tabs.length >= 1
        ? "partial"
        : "missing";

  push(items, {
    id: "core-screens",
    category: "screens",
    title: "Core screens & navigation",
    status: screensStatus,
    plainWhy:
      screensStatus === "have"
        ? `${model.tabs.length} tabs and sample content are in your preview.`
        : "You need enough screens that users can complete the main job of your app.",
    inPreview: screensStatus !== "missing",
    priority: "launch_blocker",
  });

  const onboardingStatus: ReadinessStatus =
    model.onboarding.length >= 2
      ? "partial"
      : model.onboarding.length > 0
        ? "partial"
        : model.flow?.setupFields?.length
          ? "partial"
          : "missing";

  push(items, {
    id: "onboarding",
    category: "onboarding",
    title: "First-launch onboarding",
    status: onboardingStatus,
    plainWhy:
      onboardingStatus === "missing"
        ? "New users need a short intro before the main app — what it does and why they should care."
        : "Slides or setup exist in the preview, but they are not tied to real accounts yet.",
    inPreview: onboardingStatus !== "missing",
    priority: dualSided ? "launch_blocker" : "soon",
  });

  if (dualSided) {
    push(items, {
      id: "roles",
      category: "auth",
      title: "Owner vs provider roles",
      status: "partial",
      plainWhy: `Role pick (${model.flow!.roles!.map((r) => r.label).join(" / ")}) is in the preview — real sign-in per role still needed.`,
      inPreview: true,
      priority: "launch_blocker",
    });
  }

  const authMentioned = hasInText(
    blob,
    /sign[\s-]?in|log[\s-]?in|account|auth|register|email password/
  );
  push(items, {
    id: "auth",
    category: "auth",
    title: "Sign up & sign in",
    status: authMentioned ? "partial" : "missing",
    plainWhy:
      "People need their own account so data follows them across devices. The preview does not save accounts yet.",
    inPreview: false,
    priority: "launch_blocker",
  });

  push(items, {
    id: "backend",
    category: "backend",
    title: "Database (e.g. Supabase)",
    status: "missing",
    plainWhy:
      "Lists, profiles, and messages need to live on a server — not just in the preview. Supabase is a common pick.",
    inPreview: false,
    priority: "launch_blocker",
  });

  const needsPayments =
    dualSided ||
    hasInText(blob, /pay|subscription|premium|sell|marketplace|booking fee|commission/) ||
    ctx.appShapes.some((s) =>
      /marketplace|booking|commerce|local_marketplace|job_gig/i.test(s)
    );

  if (needsPayments) {
    push(items, {
      id: "payments",
      category: "payments",
      title: "Payments or subscriptions",
      status: modelHasPaymentsUi(model) ? "partial" : "missing",
      plainWhy: modelHasPaymentsUi(model)
        ? "Payment UI may appear in the preview, but real checkout (Stripe, App Store) is not wired up."
        : "Marketplace and paid apps need a way to charge — in-app purchase or subscription.",
      inPreview: modelHasPaymentsUi(model),
      priority: "launch_blocker",
    });
  }

  const needsMessaging =
    ctx.essentialFeatures.some((e) => /message|chat|inbox/i.test(e)) ||
    ctx.appShapes.some((s) =>
      /marketplace|booking|social|local_marketplace|dating_match/i.test(s)
    ) ||
    dualSided;

  if (needsMessaging) {
    push(items, {
      id: "messaging",
      category: "messaging",
      title: "In-app messaging",
      status: modelHasMessagingTab(model) ? "partial" : "missing",
      plainWhy: modelHasMessagingTab(model)
        ? "A Messages tab is in the preview — real-time chat still needs a backend."
        : "Users often need to coordinate (bookings, questions, updates) without leaving the app.",
      inPreview: modelHasMessagingTab(model),
      priority: dualSided ? "launch_blocker" : "soon",
    });
  }

  push(items, {
    id: "legal",
    category: "legal",
    title: "Privacy policy & terms",
    status: profileHasLegalRow(model) ? "partial" : "missing",
    plainWhy: profileHasLegalRow(model)
      ? "Settings mention legal pages — you still need real hosted documents for the App Store."
      : "Apple and Google require a privacy policy URL before you can publish.",
    inPreview: profileHasLegalRow(model),
    priority: "launch_blocker",
  });

  push(items, {
    id: "landing",
    category: "growth",
    title: "Landing page & App Store link",
    status: "missing",
    plainWhy:
      "Stores ask for a website URL. A one-page site with screenshots and a download button is required.",
    inPreview: false,
    priority: "launch_blocker",
  });

  if (!hasInText(blob, /push|notification|remind/)) {
    push(items, {
      id: "push",
      category: "growth",
      title: "Push notifications",
      status: "missing",
      plainWhy:
        "Reminders bring people back (walk starting, habit due, order shipped). Optional early, valuable at launch.",
      inPreview: false,
      priority: "nice_to_have",
    });
  }

  for (const essential of ctx.essentialFeatures.slice(0, 6)) {
    if (essentialLooksCovered(essential, model, blob)) continue;
    if (items.some((i) => i.title.toLowerCase().includes(essential.slice(0, 12).toLowerCase())))
      continue;
    push(items, {
      id: `essential-${essential.slice(0, 24).replace(/\W+/g, "-")}`,
      category: "screens",
      title: essential,
      status: "missing",
      plainWhy: `Common for ${ctx.category} apps like yours — worth planning even if it is not in the preview yet.`,
      inPreview: false,
      priority: "soon",
    });
  }

  const haveCount = items.filter((i) => i.status === "have").length;
  const partialCount = items.filter((i) => i.status === "partial").length;
  const missingCount = items.filter((i) => i.status === "missing").length;
  const launchBlockers = items.filter((i) => i.priority === "launch_blocker" && i.status !== "have");

  const topGaps = [
    ...launchBlockers.filter((i) => i.status === "missing").slice(0, 4),
    ...items.filter((i) => i.priority === "soon" && i.status === "missing").slice(0, 2),
  ].slice(0, 5);

  return {
    appName: mp.appName,
    category: ctx.category,
    items,
    haveCount,
    partialCount,
    missingCount,
    discussedCount: 0,
    launchBlockers,
    topGaps,
  };
}

const STATUS_ICON: Record<ReadinessStatus, string> = {
  have: "✓",
  partial: "◐",
  missing: "○",
};

/** Markdown checklist for chat bubbles. */
export function formatReadinessChecklist(
  audit: AppReadinessAudit,
  mode: "brainstorm" | "build" = "brainstorm"
): string {
  const lines: string[] = [
    `**What your app still needs**`,
    `_${audit.haveCount} ready · ${audit.partialCount} in preview only · ${audit.missingCount} to plan_`,
    "",
  ];

  const order: ReadinessCategory[] = [
    "screens",
    "onboarding",
    "auth",
    "backend",
    "messaging",
    "payments",
    "legal",
    "growth",
  ];

  for (const cat of order) {
    const group = audit.items.filter((i) => i.category === cat);
    if (!group.length) continue;
    for (const item of group) {
      lines.push(`${STATUS_ICON[item.status]} **${item.title}** — ${item.plainWhy}`);
    }
  }

  const extra = audit.items.filter((i) => !order.includes(i.category));
  for (const item of extra) {
    lines.push(`${STATUS_ICON[item.status]} **${item.title}** — ${item.plainWhy}`);
  }

  lines.push("");
  lines.push("_Full list above — start with the **3 suggestions below** and press Enter._");
  lines.push(
    mode === "build"
      ? "_Tap to fix anything in the preview — or switch to **Brainstorm** to ask about any line._"
      : "_Ask me about any line — or switch to **Build** to change the preview._"
  );
  return lines.join("\n").trim();
}

function suggestionScore(item: ReadinessItem): number {
  let s = 0;
  if (item.priority === "launch_blocker") s += 100;
  if (item.status === "missing") s += 40;
  if (item.status === "partial") s += 15;
  if (item.category === "auth") s += 35;
  if (item.category === "backend") s += 30;
  if (item.category === "messaging") s += 20;
  if (item.category === "payments") s += 18;
  if (item.userState?.discussed) s -= 200;
  return s;
}

function pillLabel(item: ReadinessItem): string {
  const byId: Record<string, string> = {
    auth: "Set up sign in",
    backend: "Where data lives",
    messaging: "In-app messaging",
    payments: "Payments",
    legal: "Privacy & terms",
    landing: "Landing page",
    onboarding: "Onboarding",
    roles: "Two user roles",
    push: "Push notifications",
  };
  return byId[item.id] ?? (item.title.length > 32 ? `${item.title.slice(0, 30)}…` : item.title);
}

function pillPrompt(item: ReadinessItem, appName: string): string {
  const byId: Record<string, string> = {
    auth: `What do I need to set up sign in for ${appName}? Walk me through it simply.`,
    backend: `What is Supabase and what would ${appName} need to store there?`,
    messaging: `How should in-app messaging work for ${appName}?`,
    payments: `Do I need payments for ${appName}? What are my options?`,
    legal: `What privacy policy and terms do I need before the App Store?`,
    landing: `What should my App Store landing page include for ${appName}?`,
    onboarding: `How do I connect onboarding to real user accounts in ${appName}?`,
    roles: `How should owner and walker accounts work in ${appName}?`,
    push: `Do I need push notifications for ${appName} at launch?`,
  };
  return (
    byId[item.id] ??
    `What do I need for "${item.title}" in ${appName}? Keep it simple — what should I do first?`
  );
}

/** Top 3 normie next steps — shown as pills above chat. */
export function getReadinessSuggestions(audit: AppReadinessAudit): ReadinessSuggestion[] {
  const sorted = [...audit.items]
    .filter((i) => i.status !== "have" && !i.userState?.discussed)
    .sort((a, b) => suggestionScore(b) - suggestionScore(a));

  return sorted.slice(0, 3).map((item, i) => ({
    id: `sug-${item.id}`,
    label: pillLabel(item),
    prompt: pillPrompt(item, audit.appName),
    itemId: item.id,
    step: i + 1,
  }));
}

/** Opening engineering-review message after build. */
export function formatReadinessIntro(audit: AppReadinessAudit): string {
  const steps = getReadinessSuggestions(audit);
  const stepLines =
    steps.length > 0
      ? steps.map((s) => `**${s.step}. ${s.label}**`).join(" → ")
      : "**review the checklist**";

  return (
    `Your **${audit.appName}** preview looks solid for a first pass — nice work. ` +
    `Before you ship, most apps tackle things in order: ${stepLines}. ` +
    `Don't stress the full list yet — **tap a suggestion below**, press **Enter**, and I'll guide you step by step.`
  );
}

/** Compact context for brainstorm system prompt. */
export function summarizeAuditForBrainstorm(audit: AppReadinessAudit): string {
  const lines = audit.items.map(
    (i) =>
      `- [${i.status}] ${i.title} (${i.priority}): ${i.plainWhy}${i.inPreview ? " [UI in preview only]" : ""}`
  );
  return `APP READINESS AUDIT for ${audit.appName} (${audit.category}):\n${lines.join("\n")}`;
}

/** Short model summary for brainstorm. */
export function summarizeModelForBrainstorm(model: ExpoAppModel): string {
  const tabs = model.tabs.map((t) => t.label).join(", ");
  const onboarding = model.onboarding.length
    ? `${model.onboarding.length} onboarding slides`
    : "no onboarding slides";
  const roles = model.flow?.roles?.length
    ? `role flow: ${model.flow.roles.map((r) => r.label).join(" / ")}`
    : "single-user flow";
  const items = countListItems(model);
  return (
    `Preview today: tabs [${tabs}], ${items} list cards, ${onboarding}, ${roles}. ` +
    `Hero: "${model.home.heroLabel}". Capabilities: ${model.capabilities.enabled.join(", ") || "standard UI"}.`
  );
}
