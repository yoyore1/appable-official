/*--------------------------------------------------------------------------------------
 *  ExpoAppModel subset — mirrors web spec for Swift codegen (Void electron-main).
 *--------------------------------------------------------------------------------------*/

import type { Vibe } from './appableBuilderTypes.js';
import type { AppReadinessAuditDto } from './readinessTypes.js';

export interface ExpoListItem {
	id: string;
	title: string;
	subtitle: string;
	meta?: string;
	badge?: string;
	imageUrl: string;
	primaryAction?: string;
	forRole?: string;
	body?: string;
}

export interface ExpoTab {
	id: string;
	label: string;
	icon: string;
}

export interface ExpoOnboardingSlide {
	title: string;
	subtitle: string;
	imageUrl: string;
	ctaLabel?: string;
}

export interface ExpoTabScreen {
	title: string;
	subtitle: string;
	items: ExpoListItem[];
}

export interface ExpoAppTheme {
	accent: string;
	cream: string;
	charcoal: string;
	muted: string;
	vibe: Vibe;
}

export interface CapabilityAuditSnapshot {
	required: string[];
	pass: boolean;
	statusByCapability?: Record<string, 'have' | 'partial' | 'missing'>;
}

export interface ExpoAppFlow {
	roles?: { id: string; label: string; description: string }[];
	auth?: {
		enabled: boolean;
		signUpTitle: string;
		signInTitle: string;
	};
}

export interface PreviewActionRule {
	match: string;
	kind: string;
	toast: string;
	navigateTabId?: string;
	statusBadge?: string;
	statusMeta?: string;
	nextPrimaryAction?: string;
	composeTitle?: string;
	openDetailAfter?: boolean;
	detailAppend?: string;
}

export interface ExpoAppModel {
	version: 1;
	category: string;
	flow?: ExpoAppFlow;
	previewActions?: { rules: PreviewActionRule[]; messagingTabId?: string; feedTabId?: string };
	tabs: ExpoTab[];
	onboarding: ExpoOnboardingSlide[];
	home: {
		headline: string;
		subheadline: string;
		heroLabel: string;
		heroSublabel: string;
		sections: { title: string; items: ExpoListItem[] }[];
	};
	homeByRole?: Record<string, ExpoAppModel['home']>;
	tabScreens: Record<string, ExpoTabScreen>;
	profile: {
		displayName: string;
		tagline: string;
		stats: { label: string; value: string }[];
		settings: { label: string; icon: string }[];
	};
	theme: ExpoAppTheme;
	capabilityAudit?: CapabilityAuditSnapshot;
}

export type BuildSpecReadiness = AppReadinessAuditDto;

export interface ProjectBuildSpec {
	projectId: string;
	userId: string;
	masterPrompt: import('./appableBuilderTypes.js').MasterBuildPrompt;
	interview: import('./appableBuilderTypes.js').InterviewTurn[];
	expoAppModel: ExpoAppModel | null;
	capabilityAudit: CapabilityAuditSnapshot | null;
	readiness: BuildSpecReadiness | null;
}
