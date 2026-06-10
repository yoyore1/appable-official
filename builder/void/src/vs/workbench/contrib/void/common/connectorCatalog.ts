/*--------------------------------------------------------------------------------------
 *  Integration marketplace catalog — display metadata for Void UI (no connect logic).
 *--------------------------------------------------------------------------------------*/

export type ConnectorCategory =
	| 'backend' | 'analytics' | 'crash' | 'deep_linking' | 'reviews' | 'push'
	| 'attribution' | 'monetization' | 'ads' | 'chat' | 'support' | 'auth'
	| 'publishing' | 'version_control';

export type ConnectorId =
	| 'supabase' | 'revenuecat' | 'railway' | 'posthog' | 'sentry' | 'branch'
	| 'appfollow' | 'onesignal' | 'appsflyer' | 'superwall' | 'admob' | 'stream'
	| 'crisp' | 'apple-sign-in' | 'google-sign-in' | 'app-store-connect' | 'eas-build' | 'github';

export interface CatalogEntry {
	id: ConnectorId;
	displayName: string;
	category: ConnectorCategory;
	role: string;
	connectionsLabel: string;
	connectable: boolean;
	dependsOn?: ConnectorId[];
}

export const CONNECTOR_CATEGORY_LABELS: Record<ConnectorCategory, string> = {
	backend: 'Backend',
	analytics: 'Analytics',
	crash: 'Crash reporting',
	deep_linking: 'Deep linking',
	reviews: 'Review monitoring',
	push: 'Push notifications',
	attribution: 'Attribution',
	monetization: 'Monetization',
	ads: 'Ads',
	chat: 'In-app chat',
	support: 'Customer support',
	auth: 'Auth',
	publishing: 'Publishing',
	version_control: 'Version control',
};

export const MARKETPLACE_CATALOG: CatalogEntry[] = [
	{ id: 'supabase', displayName: 'Supabase', category: 'backend', role: 'Accounts, database, profiles, and real-time data.', connectionsLabel: 'Connect Supabase', connectable: true },
	{ id: 'revenuecat', displayName: 'RevenueCat', category: 'monetization', role: 'In-app purchases and subscriptions — syncs to Supabase via webhooks.', connectionsLabel: 'Connect RevenueCat', connectable: true, dependsOn: ['supabase'] },
	{ id: 'superwall', displayName: 'Superwall', category: 'monetization', role: 'Remote paywall experiments — pairs with RevenueCat.', connectionsLabel: 'Connect Superwall', connectable: true, dependsOn: ['revenuecat'] },
	{ id: 'railway', displayName: 'Railway', category: 'backend', role: 'Custom API, workers, and cron when Supabase is not enough.', connectionsLabel: 'Connect Railway', connectable: true },
	{ id: 'posthog', displayName: 'PostHog', category: 'analytics', role: 'Product analytics, funnels, and session replay.', connectionsLabel: 'Add PostHog', connectable: true },
	{ id: 'sentry', displayName: 'Sentry', category: 'crash', role: 'Crash reporting and performance monitoring.', connectionsLabel: 'Connect Sentry', connectable: true },
	{ id: 'branch', displayName: 'Branch.io', category: 'deep_linking', role: 'Deep links, deferred deep links, and attribution links.', connectionsLabel: 'Connect Branch', connectable: true },
	{ id: 'appfollow', displayName: 'AppFollow', category: 'reviews', role: 'App Store review monitoring and ASO insights.', connectionsLabel: 'Connect AppFollow', connectable: true },
	{ id: 'onesignal', displayName: 'OneSignal', category: 'push', role: 'Push notifications and in-app messaging campaigns.', connectionsLabel: 'Connect OneSignal', connectable: true, dependsOn: ['supabase'] },
	{ id: 'appsflyer', displayName: 'AppsFlyer', category: 'attribution', role: 'Mobile attribution and campaign measurement.', connectionsLabel: 'Connect AppsFlyer', connectable: true },
	{ id: 'admob', displayName: 'AdMob', category: 'ads', role: 'In-app ads and rewarded video.', connectionsLabel: 'Connect AdMob', connectable: true },
	{ id: 'stream', displayName: 'Stream', category: 'chat', role: 'Production-grade in-app chat SDK.', connectionsLabel: 'Connect Stream', connectable: true },
	{ id: 'crisp', displayName: 'Crisp', category: 'support', role: 'In-app customer support chat widget.', connectionsLabel: 'Connect Crisp', connectable: true },
	{ id: 'apple-sign-in', displayName: 'Apple Sign In', category: 'auth', role: 'Sign in with Apple — configured via Supabase Auth or native.', connectionsLabel: 'Add Apple Sign In', connectable: false, dependsOn: ['supabase'] },
	{ id: 'google-sign-in', displayName: 'Google Sign In', category: 'auth', role: 'Google OAuth — configured via Supabase Auth or native.', connectionsLabel: 'Add Google Sign In', connectable: false, dependsOn: ['supabase'] },
	{ id: 'app-store-connect', displayName: 'App Store Connect API', category: 'publishing', role: 'Automate TestFlight and App Store submissions.', connectionsLabel: 'Connect App Store Connect', connectable: true },
	{ id: 'eas-build', displayName: 'EAS Build', category: 'publishing', role: 'Expo Application Services — cloud iOS and Android builds.', connectionsLabel: 'Connect EAS Build', connectable: true },
	{ id: 'github', displayName: 'GitHub', category: 'version_control', role: 'Connect your repo for export, CI, and builder handoff.', connectionsLabel: 'Connect GitHub', connectable: true },
];

export const CONNECTOR_ACCENT: Record<ConnectorId, string> = {
	supabase: '#10B981',
	revenuecat: '#6366F1',
	railway: '#A855F7',
	posthog: '#F97316',
	sentry: '#8B5CF6',
	branch: '#0EA5E9',
	appfollow: '#EC4899',
	onesignal: '#E11D48',
	appsflyer: '#2563EB',
	superwall: '#14B8A6',
	admob: '#FACC15',
	stream: '#3B82F6',
	crisp: '#06B6D4',
	'apple-sign-in': '#1F2937',
	'google-sign-in': '#4285F4',
	'app-store-connect': '#64748B',
	'eas-build': '#000000',
	github: '#24292F',
};

export function getCatalogEntry(id: ConnectorId): CatalogEntry {
	return MARKETPLACE_CATALOG.find((e) => e.id === id)!;
}
