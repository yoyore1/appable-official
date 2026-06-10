/*--------------------------------------------------------------------------------------
 *  Post-codegen verify — model spec vs generated Swift files.
 *--------------------------------------------------------------------------------------*/

import type { ExpoAppModel } from '../../common/expoAppModelTypes.js';
import { effectivePreviewRules } from './previewActionSeed.js';
import type { GeneratedFile } from './swiftgen.js';

export interface SwiftSpecVerifyResult {
	pass: boolean;
	issues: string[];
	checked: string[];
}

export function verifySwiftAgainstModel(
	files: GeneratedFile[],
	model: ExpoAppModel
): SwiftSpecVerifyResult {
	const issues: string[] = [];
	const checked: string[] = [];
	const byPath = new Map(files.map((f) => [f.path, f.contents]));

	const need = (path: string, label: string) => {
		checked.push(label);
		if (!byPath.has(path)) { issues.push(`Missing ${path}`); }
	};

	need('Sources/Models/AppState.swift', 'AppState');
	need('Sources/Models/PreviewActionRouter.swift', 'PreviewActionRouter');
	need('Sources/Views/ItemCard.swift', 'ItemCard');
	need('Sources/Views/DetailSheet.swift', 'DetailSheet');
	need('Sources/Views/ComposeSheet.swift', 'ComposeSheet');

	const rules = effectivePreviewRules(model).rules;
	checked.push(`previewActions rules (${rules.length})`);
	const router = byPath.get('Sources/Models/PreviewActionRouter.swift') ?? '';
	for (const r of rules.slice(0, 12)) {
		if (!router.includes(r.match)) {
			issues.push(`previewActions rule not in Swift: "${r.match}" (${r.kind})`);
		}
	}

	for (const kind of ['compose_message', 'navigate_tab', 'update_status', 'save', 'open_detail']) {
		if (rules.some((r) => r.kind === kind) && !router.includes(`case "${kind}"`)) {
			issues.push(`Swift router missing handler for kind: ${kind}`);
		}
	}

	const effective = effectivePreviewRules(model);
	if (effective.messagingTabId && rules.some((r) => r.kind === 'compose_message')) {
		checked.push('messagingTab navigation');
		if (!router.includes(effective.messagingTabId)) {
			issues.push(`compose_message should navigate to tab "${effective.messagingTabId}"`);
		}
	}

	const profile = byPath.get('Sources/Views/ProfileView.swift') ?? '';
	const needsSignOut = model.profile.settings.some((s) => /sign[\s-]?out/i.test(s.label));
	if (needsSignOut && !/signOut/.test(profile)) {
		issues.push('Profile missing signOut wiring');
	}

	if (model.capabilityAudit?.pass === false) {
		checked.push('capabilityAudit (warn)');
		issues.push('Web capability audit did not fully pass — review readiness checklist');
	}

	const itemCount = model.tabs.length;
	const root = byPath.get('Sources/RootView.swift') ?? '';
	if (itemCount >= 2 && (root.match(/tabItem/g) ?? []).length < Math.min(itemCount, 2)) {
		issues.push('RootView tab count may not match model.tabs');
	}

	return { pass: issues.length === 0, issues, checked };
}
