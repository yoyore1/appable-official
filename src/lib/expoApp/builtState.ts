import type { ExpoAppModel, ExpoTab } from "./types";
import { modelHasAccountControls, withLegalSettings } from "./smartInteractions";

/** What Build has already put in the live preview — Brainstorm must not re-recommend these. */
export function summarizeBuiltState(model: ExpoAppModel): string {
  const lines: string[] = [];

  lines.push(
    `Tabs (${model.tabs.length}): ${model.tabs.map((t) => `${t.label} [${t.id}]`).join(", ")}`
  );

  if (model.flow?.auth?.enabled) {
    const live = model.flow.auth.liveSupabase ? " + live Supabase email" : "";
    lines.push(`Auth: sign-up and sign-in in preview${live}`);
  }

  const messagingTabId = model.previewActions?.messagingTabId;
  const messagesTab = model.tabs.find((t) =>
    /message|chat|inbox/i.test(`${t.id} ${t.label}`)
  );
  if (messagingTabId || messagesTab) {
    const id = messagingTabId ?? messagesTab!.id;
    const wired = Boolean(messagingTabId && model.tabScreens[id]?.items?.length);
    lines.push(
      wired
        ? `Messaging: Messages tab wired (${id}) with sample threads + compose`
        : `Messaging: tab "${id}" exists — may need full wire (threads + backend)`
    );
  }

  const account = modelHasAccountControls(withLegalSettings(model));
  if (account.signOut && account.deleteAccount) {
    lines.push("Profile: Sign out and Delete account in settings");
  } else if (account.signOut || account.deleteAccount) {
    lines.push("Profile: partial account controls (need both Sign out + Delete account)");
  }

  if (model.flow?.roles?.length) {
    lines.push(
      `Roles: ${model.flow.roles.map((r) => r.label).join(" / ")} in onboarding flow`
    );
  }

  if (model.onboarding.length > 0) {
    lines.push(
      `Onboarding: ${model.onboarding.length} slide(s) — ${model.onboarding
        .slice(0, 2)
        .map((s) => s.title)
        .join(", ")}`
    );
  }

  lines.push(`Home headline: "${model.home.headline}"`);

  return lines.join("\n");
}

export function coachBuiltStateBlock(model: ExpoAppModel | null): string {
  if (!model) return "";
  return (
    "--- Already built in preview (do NOT tell them to add these again) ---\n" +
    summarizeBuiltState(model) +
    "\nIf they ask about something above, confirm it's in the app and say what still needs production wiring (Supabase, OAuth, etc.)."
  );
}

export function buildAgentBuiltStateBlock(model: ExpoAppModel): string {
  return (
    "--- Current preview (what already exists — preserve tabs unless user asked to remove) ---\n" +
    summarizeBuiltState(model)
  );
}

/** Add or reuse a Messages tab without dropping existing tabs (e.g. Settings). */
export function resolveMessagesTab(tabs: ExpoTab[]): { tabs: ExpoTab[]; tabId: string } {
  const existing = tabs.find((t) => /message|chat|inbox/i.test(`${t.id} ${t.label}`));
  if (existing) {
    return { tabs, tabId: existing.id };
  }

  const alertsIdx = tabs.findIndex(
    (t) =>
      /^(alerts?|notifications?|activity)$/i.test(t.label.trim()) &&
      !/message|chat|inbox/i.test(`${t.id} ${t.label}`)
  );
  if (alertsIdx >= 0) {
    const tabId = tabs[alertsIdx].id;
    const next = tabs.map((t, i) =>
      i === alertsIdx ? { ...t, label: "Messages", icon: "bell" as const } : t
    );
    return { tabs: next, tabId };
  }

  const tabId = "messages";
  const tab: ExpoTab = { id: tabId, label: "Messages", icon: "bell" };
  return { tabs: [...tabs, tab], tabId };
}

export function userAskedToRemoveTab(message: string): boolean {
  return /\b(remove|delete|drop|hide)\b.*\b(tab|settings|screen)\b/i.test(message);
}
