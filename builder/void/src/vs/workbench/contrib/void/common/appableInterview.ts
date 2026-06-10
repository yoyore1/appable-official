/*--------------------------------------------------------------------------------------
 *  Shared interview — mirrors the Appable web platform flow (suggestions + Let Appable pick).
 *--------------------------------------------------------------------------------------*/

import { isDeferToRecommendation, recommendColorsAck } from './appableDesignResearch.js';
import {
	FULL_STEPS,
	INTERVIEW_QUESTIONS,
	APPABLE_PICK,
	type InterviewStepId,
	getNextSpineStep,
	isSpineDone,
} from './appableInterviewFlow.js';
import {
	getInterviewStepChoices,
	isAppablePick,
	resolveInterviewAnswer,
} from './appableInterviewSuggestions.js';
import type { InterviewAnswers, InterviewTurn, MasterBuildPrompt } from './appableBuilderTypes.js';

export {
	FULL_STEPS,
	INTERVIEW_QUESTIONS,
	APPABLE_PICK,
	getInterviewStepChoices,
	isAppablePick,
	getNextSpineStep,
	isSpineDone,
};

export type InterviewQuestionId = keyof InterviewAnswers;

export const BUILDING_STEPS = [
	'Reading your idea ✨',
	'Designing your onboarding',
	'Setting up your screens',
	'Tailoring privacy & support…',
	'Making it beautiful…',
	'Almost there',
];

export function planWelcomeMessage(mp: MasterBuildPrompt): string {
	const feats = mp.features.slice(0, 2).join(', ').toLowerCase() || 'your idea';
	const featLine = feats.charAt(0).toUpperCase() + feats.slice(1);
	return `Found “${mp.appName}” — ${mp.vibe.toLowerCase()}, for ${mp.audience.toLowerCase()}. ${featLine}. ${mp.colors} palette. Tap “Build my app” when you're ready.`;
}

export function handoffWelcomeMessage(mp: MasterBuildPrompt): string {
	return planWelcomeMessage(mp);
}

export interface BuildAppStep {
	label: string;
	atPercent: number;
}

export function buildAppSteps(mp?: MasterBuildPrompt | null): BuildAppStep[] {
	const name = mp?.appName;
	const vibe = mp?.vibe?.toLowerCase();
	const palette = mp?.colors?.split('&')[0]?.trim().toLowerCase();
	const screens = mp?.screens?.filter(Boolean).slice(0, 3) ?? [];

	const steps: BuildAppStep[] = [
		{ label: 'Pulling your saved plan ✨', atPercent: 0 },
		{ label: name ? `Loading “${name}”` : 'Loading your plan', atPercent: 6 },
		{ label: vibe ? `Setting the ${vibe} feel` : 'Setting your vibe', atPercent: 12 },
		{ label: 'Sketching screen layouts', atPercent: 18 },
		{ label: 'Designing your onboarding', atPercent: 24 },
	];

	if (screens[0]) { steps.push({ label: `Building ${screens[0]}`, atPercent: 32 }); }
	if (screens[1]) { steps.push({ label: `Building ${screens[1]}`, atPercent: 40 }); }
	if (screens[2]) { steps.push({ label: `Building ${screens[2]}`, atPercent: 46 }); }
	else { steps.push({ label: 'Building your main screens', atPercent: 42 }); }

	steps.push(
		{ label: 'Wiring navigation & tabs', atPercent: 52 },
		{ label: palette ? `Applying ${palette} tones` : 'Applying your palette', atPercent: 58 },
		{ label: 'Setting up your screens', atPercent: 64 },
		{ label: 'Writing SwiftUI code', atPercent: 70 },
		{ label: 'Tailoring privacy & support for this app…', atPercent: 74 },
		{ label: 'Running a quality check', atPercent: 76 },
		{ label: 'Polishing the details', atPercent: 82 },
		{ label: 'Making it beautiful…', atPercent: 88 },
		{ label: 'Almost there', atPercent: 94 },
		{ label: 'Wrapping up', atPercent: 98 },
	);
	return steps;
}

export function buildStepIndex(percent: number, steps: BuildAppStep[]): number {
	let idx = 0;
	for (let i = 0; i < steps.length; i++) {
		if (percent >= steps[i].atPercent) { idx = i; }
	}
	return idx;
}

/** Build interview turns from collected answers (for plan + suggestions). */
export function interviewTurnsFromAnswers(answers: Partial<InterviewAnswers>): InterviewTurn[] {
	return FULL_STEPS
		.map((step) => ({
			questionId: step.id,
			question: step.prompt,
			answer: String(answers[step.id as keyof InterviewAnswers] ?? '').trim(),
		}))
		.filter((t) => t.answer.length > 0);
}

export function turnsToAnswers(turns: InterviewTurn[]): InterviewAnswers {
	const out: Partial<InterviewAnswers> = {};
	for (const t of turns) {
		if (['idea', 'audience', 'features', 'name', 'colors'].includes(t.questionId)) {
			(out as Record<string, string>)[t.questionId] = t.answer;
		}
	}
	return {
		idea: out.idea ?? '',
		audience: out.audience ?? '',
		features: out.features ?? '',
		name: out.name ?? '',
		colors: out.colors ?? '',
	};
}

export interface ProcessedInterviewAnswer {
	storedAnswer: string;
	displayAnswer: string;
	turn: InterviewTurn;
	acks: string[];
}

/** Normalize answer, resolve Let Appable pick, echo acks — matches web spine behavior. */
export function processInterviewAnswer(
	stepId: InterviewStepId,
	rawAnswer: string,
	priorTurns: InterviewTurn[],
	prefetchedPick?: string
): ProcessedInterviewAnswer {
	const step = FULL_STEPS.find((s) => s.id === stepId)!;
	const submitted = rawAnswer.trim() || (stepId === 'colors' ? 'No preference' : rawAnswer.trim());
	const normalized = isAppablePick(submitted)
		? (prefetchedPick?.trim() || resolveInterviewAnswer(stepId, submitted, priorTurns))
		: resolveInterviewAnswer(stepId, submitted, priorTurns);

	const turn: InterviewTurn = { questionId: stepId, question: step.prompt, answer: normalized };
	const interview = [...priorTurns, turn];

	let acks: string[] = [];
	if (stepId === 'colors' && (isAppablePick(submitted) || isDeferToRecommendation(normalized))) {
		acks = [recommendColorsAck(interview)];
	} else {
		const line = warmFromAnswer(stepId, normalized, priorTurns);
		if (line) { acks = [line]; }
	}

	return {
		storedAnswer: normalized,
		displayAnswer: normalized,
		turn,
		acks,
	};
}

function hashPick(seed: string, options: string[]): string {
	let h = 0;
	for (let i = 0; i < seed.length; i++) {
		h = (h * 31 + seed.charCodeAt(i)) | 0;
	}
	return options[Math.abs(h) % options.length];
}

function answerSnippet(answer: string, max = 56): string {
	const first = answer.trim().split(/[.!?\n]/)[0]?.trim() ?? '';
	if (!first) { return ''; }
	if (first.length <= max) { return first; }
	const cut = first.slice(0, max);
	const lastSpace = cut.lastIndexOf(' ');
	return (lastSpace > 14 ? cut.slice(0, lastSpace) : cut).trim();
}

function capitalizeFirst(s: string): string {
	return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function semanticHook(answer: string): string {
	const a = answer.toLowerCase();
	if (/dog|pet|puppy/.test(a) && /walk|walker|sitter|sit/.test(a)) { return 'a dog walker marketplace'; }
	if (/connect|match|marketplace|link/.test(a) && /area|location|nearby|local|neighborhood/.test(a)) { return 'matching people by area'; }
	if (/recipe|dish|food|meal|cook/.test(a) && /\bphoto\b|camera|snap|picture/.test(a)) { return 'photo → recipe'; }
	if (/flight|travel|trip|hotel/.test(a)) { return 'finding flights'; }
	if (/fitness|workout|gym|run/.test(a)) { return 'workout tracking'; }
	if (/book|appointment|schedule|calendar/.test(a)) { return 'booking without phone tag'; }
	return '';
}

function warmFromAnswer(
	questionId: InterviewStepId,
	answer: string,
	prior?: InterviewTurn[]
): string {
	const a = answer.toLowerCase();
	const idea = (prior?.find((t) => t.questionId === 'idea')?.answer ?? '').toLowerCase();
	const seed = `${questionId}:${answer}`;

	const hook = semanticHook(answer);

	if (questionId === 'idea') {
		if (/dog|pet|puppy/.test(a) && /walk|walker|sitter|sit/.test(a)) {
			return hashPick(seed, [
				'Wait a dog walker app that matches by neighborhood?? People would actually use that.',
				"Okay connecting dog walkers to owners nearby — that's such a real problem.",
				"Dog walkers + people in their area on one app — yeah that's needed.",
			]);
		}
		if (/connect|match|marketplace|link/.test(a) && /area|location|nearby|local|neighborhood/.test(a)) {
			return hashPick(seed, [
				"Oh matching people by area — that's what makes this actually work.",
				'Yeah the local piece is everything for something like this.',
				'Connecting nearby instead of random — smart angle.',
			]);
		}
		if (hook) {
			return hashPick(seed, [
				`Wait — ${hook} is actually a really clear angle.`,
				`Okay yeah ${hook} — I can totally picture the app.`,
				`${capitalizeFirst(hook)} — that could be really good.`,
			]);
		}
		return hashPick(seed, [
			"Wait that's actually such a good idea.",
			"Okay yeah tell me more — I'm already picturing it.",
			'Hmm yeah I could see people using that.',
		]);
	}

	if (questionId === 'audience') {
		const ideaBit = idea ? answerSnippet(idea, 28) : '';
		if (/dog|pet|owner/.test(a) && /dog|pet|walk/.test(idea)) {
			return hashPick(seed, [
				"Yeah busy dog owners who don't have time to walk — that's the person.",
				'Okay pet parents in your area — makes total sense for this.',
				"Dog owners who need help nearby — yep that's your crowd.",
			]);
		}
		if (ideaBit && /owner|walker|provider|freelance/.test(a)) {
			return hashPick(seed, [
				`Yeah ${answerSnippet(answer, 36)} — exactly who needs this.`,
				`Okay ${answerSnippet(answer, 32)} — I get the split now.`,
			]);
		}
		if (answerSnippet(answer, 36).length > 8) {
			return hashPick(seed, [
				`Yeah ${answerSnippet(answer, 36)} — I can picture them opening this.`,
				`${capitalizeFirst(answerSnippet(answer, 36))} — that's a clear who.`,
			]);
		}
		return hashPick(seed, [
			"Yeah I can totally picture who'd use this.",
			"Okay that helps — I know who we're building for now.",
			"Got it — that's a real audience, not vague 'everyone'.",
		]);
	}

	if (questionId === 'features') {
		const items = answer.split(/[,;]|\band\b/i).map((s) => s.trim()).filter((s) => s.length > 2 && s.split(/\s+/).length <= 10);
		if (items.length >= 2) {
			const a0 = items[0].split(/\s+/).slice(0, 5).join(' ').toLowerCase();
			const a1 = items[1].split(/\s+/).slice(0, 5).join(' ').toLowerCase();
			return hashPick(seed, [`Okay ${a0}, ${a1} — solid combo.`, `Yeah ${a0} plus ${a1} — covers the main use cases.`]);
		}
		return hashPick(seed, ['Yeah those features together actually tell a story.', "Okay that combo makes sense for what you're building."]);
	}

	if (questionId === 'name') {
		const n = answer.trim();
		if (n.length > 1) { return hashPick(seed, [`${n} — yeah that lands.`, `Wait ${n} is actually really good.`]); }
		return "Okay yeah we'll find the perfect name.";
	}

	if (questionId === 'colors') {
		const bit = answerSnippet(answer);
		if (bit.length > 3) { return hashPick(seed, [`${bit} — yeah that fits.`, `Ooh ${bit} — nice pick.`]); }
		return 'Those colors will look great.';
	}

	return hashPick(seed, ['Got it — building on that.', 'Yeah that helps — keeping going.']);
}

/** @deprecated Web spine skips acks except Let Appable pick — kept for pick echo fallback. */
export function interviewAcks(
	questionId: InterviewQuestionId,
	answer: string,
	prior?: Partial<InterviewAnswers>
): string[] {
	const priorTurns = prior ? interviewTurnsFromAnswers(prior) : [];
	return [warmFromAnswer(questionId, answer, priorTurns)];
}
