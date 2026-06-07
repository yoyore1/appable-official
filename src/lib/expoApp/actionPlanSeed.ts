import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import { findTabId } from "./tabIds";
import type {
  ExpoAppModelInput,
  ExpoListItem,
  PreviewActionKind,
  PreviewActionPlan,
  PreviewActionRule,
} from "./types";

function collectPrimaryActions(input: ExpoAppModelInput): string[] {
  const labels = new Set<string>();
  const scan = (items: ExpoListItem[]) => {
    for (const it of items) {
      if (it.primaryAction?.trim()) labels.add(it.primaryAction.trim());
    }
  };
  for (const sec of input.home.sections) scan(sec.items);
  if (input.homeByRole) {
    for (const block of Object.values(input.homeByRole)) {
      for (const sec of block.sections) scan(sec.items);
    }
  }
  for (const screen of Object.values(input.tabScreens)) scan(screen.items);
  return [...labels];
}

export function inferActionKind(label: string): PreviewActionKind {
  const l = label.toLowerCase();
  if (/reply|message|chat|text|send|contact|inbox/.test(l)) return "compose_message";
  if (/^save|favorite|bookmark|wishlist/.test(l)) return "save";
  if (
    /accept|apply|approve|book|reserve|confirm|complete|finish|start|begin|join|subscribe|decline|cancel|post|publish|create|hire|pay|checkout/.test(
      l
    )
  ) {
    return "update_status";
  }
  if (/browse|discover|find|see all|explore|view all|go to/.test(l)) return "navigate_tab";
  return "open_detail";
}

function statusFromLabel(label: string): { badge: string; meta: string } {
  const l = label.toLowerCase();
  if (/accept|approve|confirm/.test(l)) return { badge: "Confirmed", meta: "Just now" };
  if (/apply/.test(l)) return { badge: "Applied", meta: "Pending" };
  if (/book|reserve/.test(l)) return { badge: "Booked", meta: "Scheduled" };
  if (/start|begin/.test(l)) return { badge: "In progress", meta: "Started" };
  if (/complete|finish|done/.test(l)) return { badge: "Done", meta: "Completed" };
  if (/post|publish|create/.test(l)) return { badge: "Live", meta: "Published" };
  return { badge: "Updated", meta: "Just now" };
}

/** Generic seed — tab ids from THIS model only, no domain fiction. */
export function seedActionPlan(input: ExpoAppModelInput): PreviewActionPlan {
  const messagingTabId =
    findTabId(input as Parameters<typeof findTabId>[0], /message|chat|inbox|bell/i) ??
    undefined;
  const feedTabId =
    findTabId(input as Parameters<typeof findTabId>[0], /discover|search|browse|feed|explore|list/i) ??
    input.tabs.find((t) => t.id !== "home" && t.id !== "profile")?.id;

  const rules: PreviewActionRule[] = collectPrimaryActions(input).map((label) => {
    const kind = inferActionKind(label);
    const status = statusFromLabel(label);
    const rule: PreviewActionRule = {
      match: label,
      kind,
      toast: label,
    };
    if (kind === "compose_message") {
      rule.composeTitle = label;
    }
    if (kind === "update_status") {
      rule.statusBadge = status.badge;
      rule.statusMeta = status.meta;
      rule.openDetailAfter = true;
    }
    if (kind === "navigate_tab") {
      rule.navigateTabId = feedTabId;
    }
    if (kind === "open_detail") {
      rule.openDetailAfter = true;
    }
    return rule;
  });

  return { messagingTabId, feedTabId, rules };
}

/** One generic fallback rule when Kimi plan is missing a label match. */
export function fallbackRuleForLabel(
  label: string,
  input: ExpoAppModelInput
): PreviewActionRule {
  const plan = seedActionPlan(input);
  const hit = plan.rules.find((r) =>
    label.toLowerCase().includes(r.match.toLowerCase())
  );
  if (hit) return hit;
  const kind = inferActionKind(label);
  const status = statusFromLabel(label);
  return {
    match: label,
    kind,
    toast: label,
    statusBadge: kind === "update_status" ? status.badge : undefined,
    statusMeta: kind === "update_status" ? status.meta : undefined,
    navigateTabId: kind === "navigate_tab" ? plan.feedTabId : undefined,
    openDetailAfter: kind === "open_detail" || kind === "update_status",
    composeTitle: kind === "compose_message" ? label : undefined,
  };
}

export function validateActionPlan(
  input: ExpoAppModelInput,
  plan?: PreviewActionPlan
): string[] {
  const issues: string[] = [];
  if (!plan?.rules?.length) {
    issues.push("previewActions.rules required — one rule per distinct primaryAction label");
    return issues;
  }
  const tabIds = new Set(input.tabs.map((t) => t.id));
  const labels = collectPrimaryActions(input);
  for (const label of labels) {
    const hit = plan.rules.some((r) =>
      label.toLowerCase().includes(r.match.toLowerCase())
    );
    if (!hit) {
      issues.push(`previewActions missing rule for primaryAction "${label}"`);
    }
  }
  for (const rule of plan.rules) {
    if (rule.navigateTabId && !tabIds.has(rule.navigateTabId)) {
      issues.push(
        `previewActions rule "${rule.match}" references unknown tab "${rule.navigateTabId}"`
      );
    }
  }
  if (plan.messagingTabId && !tabIds.has(plan.messagingTabId)) {
    issues.push(`previewActions.messagingTabId "${plan.messagingTabId}" is not a real tab`);
  }
  return issues;
}

export function collectActionPlanGaps(
  input: ExpoAppModelInput,
  mp: MasterBuildPrompt
): string[] {
  const plan = input.previewActions ?? seedActionPlan(input);
  const gaps = validateActionPlan(input, plan);
  if (!input.previewActions) {
    gaps.push(
      `previewActions plan must be reviewed for ${mp.appName} — wire each button to a sensible outcome for this app`
    );
  }
  return gaps;
}

export function collectPrimaryActionLabels(input: ExpoAppModelInput): string[] {
  return collectPrimaryActions(input);
}
