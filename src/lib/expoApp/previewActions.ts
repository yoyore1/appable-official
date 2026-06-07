import { fallbackRuleForLabel } from "./actionPlanSeed";
import type { PreviewInteractionConfig } from "./smartInteractions";
import { findTabId } from "./tabIds";
import type {
  ExpoAppModel,
  ExpoAppModelInput,
  ExpoListItem,
  PreviewActionPlan,
  PreviewActionRule,
} from "./types";

export interface ActionOutcome {
  toast: string;
  itemPatch?: Partial<ExpoListItem>;
  navigateTab?: string;
  openDetail?: boolean;
  openCompose?: { title: string; placeholder: string };
  triggerSave?: boolean;
}

export { findTabId } from "./tabIds";

export function applyItemPatches(
  model: ExpoAppModel,
  patches: Record<string, Partial<ExpoListItem>>,
  injectedByTab: Record<string, ExpoListItem[]>
): ExpoAppModel {
  const patch = (item: ExpoListItem) => {
    const p = patches[item.id];
    return p ? { ...item, ...p } : item;
  };

  const home = {
    ...model.home,
    sections: model.home.sections.map((sec) => ({
      ...sec,
      items: sec.items.map(patch),
    })),
  };

  const homeByRole = model.homeByRole
    ? Object.fromEntries(
        Object.entries(model.homeByRole).map(([role, block]) => [
          role,
          {
            ...block,
            sections: block.sections.map((sec) => ({
              ...sec,
              items: sec.items.map(patch),
            })),
          },
        ])
      )
    : undefined;

  const tabScreens = Object.fromEntries(
    Object.entries(model.tabScreens).map(([tabId, screen]) => [
      tabId,
      {
        ...screen,
        items: [
          ...screen.items.map(patch),
          ...(injectedByTab[tabId] ?? []),
        ],
      },
    ])
  );

  for (const [tabId, items] of Object.entries(injectedByTab)) {
    if (!tabScreens[tabId]) {
      tabScreens[tabId] = {
        title: model.tabs.find((t) => t.id === tabId)?.label ?? tabId,
        subtitle: "",
        items,
      };
    }
  }

  return { ...model, home, homeByRole, tabScreens };
}

function matchRule(label: string, plan: PreviewActionPlan): PreviewActionRule | undefined {
  const l = label.toLowerCase();
  return plan.rules.find(
    (r) => l.includes(r.match.toLowerCase()) || r.match.toLowerCase() === l
  );
}

function outcomeFromRule(
  rule: PreviewActionRule,
  item: ExpoListItem,
  model: ExpoAppModel,
  plan: PreviewActionPlan
): ActionOutcome {
  const patch: Partial<ExpoListItem> = {};
  if (rule.statusBadge) patch.badge = rule.statusBadge;
  if (rule.statusMeta) patch.meta = rule.statusMeta;
  if (rule.nextPrimaryAction) patch.primaryAction = rule.nextPrimaryAction;
  if (rule.detailAppend) {
    const base = item.body ?? item.subtitle ?? "";
    patch.body = base ? `${base}\n\n${rule.detailAppend}` : rule.detailAppend;
  }

  switch (rule.kind) {
    case "compose_message":
      return {
        toast: rule.toast,
        openCompose: {
          title: rule.composeTitle ?? `Message ${item.title}`,
          placeholder: "Type your message…",
        },
        itemPatch: Object.keys(patch).length ? patch : { meta: "Just now" },
        navigateTab:
          rule.navigateTabId ?? plan.messagingTabId ?? undefined,
      };

    case "update_status":
      return {
        toast: rule.toast,
        itemPatch: Object.keys(patch).length ? patch : undefined,
        openDetail: rule.openDetailAfter,
        navigateTab: rule.navigateTabId,
      };

    case "navigate_tab":
      return {
        toast: rule.toast,
        navigateTab:
          rule.navigateTabId ??
          plan.feedTabId ??
          findTabId(model, /discover|search|browse|feed/i) ??
          undefined,
      };

    case "save":
      return { toast: rule.toast, triggerSave: true };

    case "open_detail":
    default:
      return {
        toast: rule.toast,
        openDetail: rule.openDetailAfter !== false,
      };
  }
}

/** Kimi-reviewed plan first, then generic fallback — no hardcoded domain fiction. */
export function resolveActionOutcome(
  item: ExpoListItem,
  model: ExpoAppModel,
  _ix: PreviewInteractionConfig
): ActionOutcome {
  const label = item.primaryAction ?? "Open";
  const plan = model.previewActions;

  if (plan?.rules?.length) {
    const rule = matchRule(label, plan);
    if (rule) return outcomeFromRule(rule, item, model, plan);
  }

  const fallback = fallbackRuleForLabel(label, model as ExpoAppModelInput);
  const fallbackPlan: PreviewActionPlan =
    plan ?? {
      messagingTabId:
        findTabId(model, /message|chat|inbox|bell/i) ?? undefined,
      feedTabId:
        findTabId(model, /discover|search|browse|feed/i) ?? undefined,
      rules: [fallback],
    };
  return outcomeFromRule(fallback, item, model, fallbackPlan);
}
