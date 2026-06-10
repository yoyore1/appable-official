/*--------------------------------------------------------------------------------------
 *  Readiness audit types — mirrors web readinessAudit (Void UI).
 *--------------------------------------------------------------------------------------*/

export type ReadinessStatus = 'have' | 'partial' | 'missing';
export type ReadinessPriority = 'launch_blocker' | 'soon' | 'nice_to_have';
export type ReadinessCategory =
	| 'screens' | 'auth' | 'backend' | 'onboarding' | 'payments'
	| 'messaging' | 'legal' | 'growth';

export type ReadinessDecision = 'done' | 'yes' | 'later' | 'skip';

export interface ReadinessItemStateDto {
	discussed: boolean;
	discussedAt?: string;
	decision?: ReadinessDecision | null;
}

export interface ReadinessItemDto {
	id: string;
	category: ReadinessCategory;
	title: string;
	status: ReadinessStatus;
	plainWhy: string;
	inPreview: boolean;
	priority: ReadinessPriority;
	userState?: ReadinessItemStateDto;
	pinned?: boolean;
}

export interface AppReadinessAuditDto {
	appName: string;
	category: string;
	haveCount: number;
	partialCount: number;
	missingCount: number;
	discussedCount: number;
	launchBlockers: ReadinessItemDto[];
	items: ReadinessItemDto[];
	topGaps: ReadinessItemDto[];
}

export interface ReadinessPatchRequest {
	projectId: string;
	pinnedItemId?: string | null;
	itemId?: string;
	discussed?: boolean;
	decision?: ReadinessDecision | null;
}

export interface ReadinessPatchResult {
	ok: boolean;
	readiness: AppReadinessAuditDto | null;
}
