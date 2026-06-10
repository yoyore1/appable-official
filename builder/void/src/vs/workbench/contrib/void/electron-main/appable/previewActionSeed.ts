/*--------------------------------------------------------------------------------------
 *  previewActions seed — mirrors web actionPlanSeed.ts for Swift codegen.
 *--------------------------------------------------------------------------------------*/

import type { ExpoAppModel, ExpoListItem, PreviewActionRule } from '../../common/expoAppModelTypes.js';

function findTabId(model: ExpoAppModel, re: RegExp): string | undefined {
	for (const t of model.tabs) {
		if (re.test(`${t.id} ${t.label}`)) { return t.id; }
	}
	return undefined;
}

function collectPrimaryActions(model: ExpoAppModel): string[] {
	const labels = new Set<string>();
	const scan = (items: ExpoListItem[]) => {
		for (const it of items) {
			if (it.primaryAction?.trim()) { labels.add(it.primaryAction.trim()); }
		}
	};
	for (const sec of model.home.sections) { scan(sec.items); }
	if (model.homeByRole) {
		for (const block of Object.values(model.homeByRole)) {
			for (const sec of block.sections) { scan(sec.items); }
		}
	}
	for (const screen of Object.values(model.tabScreens)) { scan(screen.items); }
	return [...labels];
}

function inferActionKind(label: string): string {
	const l = label.toLowerCase();
	if (/reply|message|chat|text|send|contact|inbox/.test(l)) { return 'compose_message'; }
	if (/^save|favorite|bookmark|wishlist/.test(l)) { return 'save'; }
	if (/accept|apply|approve|book|reserve|confirm|complete|finish|start|begin|join|subscribe|decline|cancel|post|publish|create|hire|pay|checkout/.test(l)) {
		return 'update_status';
	}
	if (/browse|discover|find|see all|explore|view all|go to/.test(l)) { return 'navigate_tab'; }
	return 'open_detail';
}

function statusFromLabel(label: string): { badge: string; meta: string } {
	const l = label.toLowerCase();
	if (/accept|approve|confirm/.test(l)) { return { badge: 'Confirmed', meta: 'Just now' }; }
	if (/apply/.test(l)) { return { badge: 'Applied', meta: 'Pending' }; }
	if (/book|reserve/.test(l)) { return { badge: 'Booked', meta: 'Scheduled' }; }
	if (/start|begin/.test(l)) { return { badge: 'In progress', meta: 'Started' }; }
	if (/complete|finish|done/.test(l)) { return { badge: 'Done', meta: 'Completed' }; }
	if (/post|publish|create/.test(l)) { return { badge: 'Live', meta: 'Published' }; }
	return { badge: 'Updated', meta: 'Just now' };
}

export function seedActionPlan(model: ExpoAppModel): {
	messagingTabId?: string;
	feedTabId?: string;
	rules: PreviewActionRule[];
} {
	const messagingTabId = findTabId(model, /message|chat|inbox|bell/i);
	const feedTabId =
		findTabId(model, /discover|search|browse|feed|explore|list/i) ??
		model.tabs.find((t) => t.id !== 'home' && t.id !== 'profile')?.id;

	const rules: PreviewActionRule[] = collectPrimaryActions(model).map((label) => {
		const kind = inferActionKind(label);
		const status = statusFromLabel(label);
		const rule: PreviewActionRule = { match: label, kind, toast: label };
		if (kind === 'compose_message') { rule.composeTitle = label; }
		if (kind === 'update_status') {
			rule.statusBadge = status.badge;
			rule.statusMeta = status.meta;
			rule.openDetailAfter = true;
		}
		if (kind === 'navigate_tab') { rule.navigateTabId = feedTabId; }
		if (kind === 'open_detail') { rule.openDetailAfter = true; }
		return rule;
	});

	return { messagingTabId, feedTabId, rules };
}

/** Merge Kimi plan with seeded fallbacks so every primaryAction label has a rule. */
export function effectivePreviewRules(model: ExpoAppModel): {
	messagingTabId?: string;
	feedTabId?: string;
	rules: PreviewActionRule[];
} {
	const seed = seedActionPlan(model);
	const plan = model.previewActions;
	if (!plan?.rules?.length) {
		return { messagingTabId: seed.messagingTabId, feedTabId: seed.feedTabId, rules: seed.rules };
	}

	const merged = [...plan.rules];
	const covered = new Set(plan.rules.map((r) => r.match.toLowerCase()));
	for (const r of seed.rules) {
		if (![...covered].some((m) => r.match.toLowerCase().includes(m) || m.includes(r.match.toLowerCase()))) {
			merged.push(r);
		}
	}
	return {
		messagingTabId: plan.messagingTabId ?? seed.messagingTabId,
		feedTabId: plan.feedTabId ?? seed.feedTabId,
		rules: merged,
	};
}
