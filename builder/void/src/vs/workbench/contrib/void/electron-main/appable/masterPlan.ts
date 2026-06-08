/*--------------------------------------------------------------------------------------
 *  Master build prompt synthesis — mirrors web generateMasterPrompt (deterministic).
 *--------------------------------------------------------------------------------------*/

import { InterviewAnswers, MasterBuildPrompt, Vibe } from '../../common/appableBuilderTypes.js';
import { inferVibe, resolveAppName, resolveColors } from '../../common/appableInterview.js';

type LayoutArchetype =
	| 'tracker-dashboard'
	| 'swipe-cards'
	| 'social-feed'
	| 'chat-messaging'
	| 'marketplace-shop'
	| 'booking-scheduling'
	| 'content-library'
	| 'habit-streak'
	| 'journal-notes'
	| 'onboarding-heavy-utility';

const ARCHETYPES: Record<
	LayoutArchetype,
	{ label: string; defaultFeatures: [string, string, string]; defaultScreens: string[]; matchKeywords: RegExp }
> = {
	'tracker-dashboard': {
		label: 'Tracker dashboard',
		defaultFeatures: ['Track daily progress', 'View stats & trends', 'Set goals & reminders'],
		defaultScreens: ['Onboarding', 'Dashboard', 'Log entry', 'History', 'Profile'],
		matchKeywords: /track|stat|dashboard|metric|log|progress|habit|streak|budget|expense|health data/i,
	},
	'swipe-cards': {
		label: 'Swipe cards',
		defaultFeatures: ['Discover with swipe cards', 'View rich profiles', 'Match & connect'],
		defaultScreens: ['Onboarding', 'Discover', 'Matches', 'Chat preview', 'Profile'],
		matchKeywords: /swipe|match|discover|date|dating|browse cards/i,
	},
	'social-feed': {
		label: 'Social feed',
		defaultFeatures: ['Scroll a personalized feed', 'Post photos & updates', 'Follow & react'],
		defaultScreens: ['Onboarding', 'Home feed', 'Create post', 'Notifications', 'Profile'],
		matchKeywords: /feed|post|follow|social|share photo|timeline|reel|story/i,
	},
	'chat-messaging': {
		label: 'Chat / messaging',
		defaultFeatures: ['Message friends in real time', 'Group chats', 'Share photos & links'],
		defaultScreens: ['Onboarding', 'Chats', 'Conversation', 'New message', 'Profile'],
		matchKeywords: /chat|message|text|dm|inbox|conversation|messaging/i,
	},
	'marketplace-shop': {
		label: 'Marketplace / shop',
		defaultFeatures: ['Browse products', 'Save to cart', 'Secure checkout'],
		defaultScreens: ['Onboarding', 'Shop home', 'Product detail', 'Cart', 'Profile'],
		matchKeywords: /shop|store|buy|cart|product|market|sell|checkout/i,
	},
	'booking-scheduling': {
		label: 'Booking / scheduling',
		defaultFeatures: ['Book appointments', 'View availability', 'Manage bookings'],
		defaultScreens: ['Onboarding', 'Browse', 'Book slot', 'My bookings', 'Profile'],
		matchKeywords: /book|schedule|appointment|calendar|reserve|slot/i,
	},
	'content-library': {
		label: 'Content library',
		defaultFeatures: ['Browse curated content', 'Save favorites', 'Search & filter'],
		defaultScreens: ['Onboarding', 'Library', 'Detail', 'Saved', 'Profile'],
		matchKeywords: /recipe|food|cook|meal|library|collection|catalog|browse content/i,
	},
	'habit-streak': {
		label: 'Habit streak',
		defaultFeatures: ['Log daily habits', 'Keep your streak', 'Celebrate milestones'],
		defaultScreens: ['Onboarding', 'Today', 'Habits', 'Streak stats', 'Profile'],
		matchKeywords: /habit|streak|daily|routine|check.?in/i,
	},
	'journal-notes': {
		label: 'Journal / notes',
		defaultFeatures: ['Capture quick notes', 'Organize entries', 'Search your journal'],
		defaultScreens: ['Onboarding', 'Journal', 'New entry', 'Search', 'Profile'],
		matchKeywords: /note|journal|write|diary|reflect/i,
	},
	'onboarding-heavy-utility': {
		label: 'Utility app',
		defaultFeatures: ['Core workflow', 'Quick actions', 'Personal settings'],
		defaultScreens: ['Onboarding', 'Home', 'Detail', 'Activity', 'Profile'],
		matchKeywords: /./,
	},
};

function parseUserFeatures(raw: string): string[] {
	return raw
		.split(/[,\n;]|(?:\band\b)/i)
		.map((s) => s.trim())
		.filter((s) => s.length > 2);
}

function mergeFeatureList(user: string[], defaults: string[]): [string, string, string] {
	const merged = [...user];
	for (const d of defaults) {
		if (merged.length >= 3) { break; }
		const dupe = merged.some(
			(m) =>
				m.toLowerCase().includes(d.toLowerCase().slice(0, 12)) ||
				d.toLowerCase().includes(m.toLowerCase().slice(0, 12))
		);
		if (!dupe) { merged.push(d); }
	}
	while (merged.length < 3) {
		merged.push(defaults[merged.length] ?? 'Core workflow');
	}
	return merged.slice(0, 3) as [string, string, string];
}

function inferArchetype(idea: string, featuresRaw: string, audience: string) {
	const blob = `${idea} ${featuresRaw} ${audience}`;
	let best: LayoutArchetype = 'onboarding-heavy-utility';
	let bestScore = 0;

	for (const [id, def] of Object.entries(ARCHETYPES) as [LayoutArchetype, (typeof ARCHETYPES)[LayoutArchetype]][]) {
		const score = def.matchKeywords.test(blob) ? 2 : 0;
		if (score > bestScore) {
			bestScore = score;
			best = id;
		}
	}

	if (bestScore === 0) {
		if (/dog|pet|walk|walker|sitter|paw/.test(blob)) { best = 'booking-scheduling'; }
		else if (/recipe|food|cook|meal|kitchen/.test(blob)) { best = 'content-library'; }
		else if (/fitness|workout|gym|run/.test(blob)) { best = 'tracker-dashboard'; }
		else if (/friend|social|community|share/.test(blob)) { best = 'social-feed'; }
		else if (/shop|buy|product|store/.test(blob)) { best = 'marketplace-shop'; }
		else if (/habit|streak|daily/.test(blob)) { best = 'habit-streak'; }
		else if (/note|journal|write/.test(blob)) { best = 'journal-notes'; }
		else if (/book|schedule|appointment/.test(blob)) { best = 'booking-scheduling'; }
		else if (/swipe|match|discover/.test(blob)) { best = 'swipe-cards'; }
		else if (/chat|message|text/.test(blob)) { best = 'chat-messaging'; }
	}

	const def = ARCHETYPES[best];
	const features = mergeFeatureList(parseUserFeatures(featuresRaw), [...def.defaultFeatures]);
	return {
		archetype: best,
		features,
		screens: [...def.defaultScreens],
		description: idea || featuresRaw || `A ${def.label.toLowerCase()} app for ${audience || 'everyday users'}.`,
	};
}

export function buildMasterPromptFromInterview(answers: InterviewAnswers): MasterBuildPrompt {
	const idea = answers.idea.trim();
	const audience = answers.audience.trim() || 'Everyday people who want something simple and beautiful.';
	const featuresRaw = answers.features.trim();
	const appName = resolveAppName(answers);
	const vibe: Vibe = inferVibe(answers);
	const colors = resolveColors(answers.colors, answers);
	const inferred = inferArchetype(idea, featuresRaw, audience);

	return {
		appName,
		description: inferred.description,
		audience,
		twist: null,
		features: [...inferred.features],
		layoutArchetype: inferred.archetype,
		vibe,
		colors,
		screens: inferred.screens,
		referenceApp: null,
	};
}
