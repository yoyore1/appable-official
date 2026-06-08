/*--------------------------------------------------------------------------------------
 *  Shared 5-question interview — mirrors the Appable web platform flow.
 *--------------------------------------------------------------------------------------*/

import { InterviewAnswers, MasterBuildPrompt, Vibe } from './appableBuilderTypes.js';

export type InterviewQuestionId = keyof InterviewAnswers;

export interface InterviewQuestion {
	id: InterviewQuestionId;
	prompt: string;
	kind: 'text' | 'choice';
}

/** Same order and copy as web `interviewQuestions` in config.ts */
export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
	{ id: 'idea', prompt: "Tell me about your app — what's the idea?", kind: 'text' },
	{ id: 'audience', prompt: "Who's it for?", kind: 'text' },
	{ id: 'features', prompt: 'What are 2–3 main things it does? (Be specific — e.g. daily habit streaks, book appointments, track progress)', kind: 'text' },
	{ id: 'name', prompt: 'What do you want to call it? (Or say "suggest one" and I\'ll name it.)', kind: 'text' },
	{ id: 'colors', prompt: 'Last one — pick a palette that feels right, or tap Surprise me:', kind: 'choice' },
];

export const BUILDING_STEPS = [
	'Reading your idea ✨',
	'Designing your onboarding',
	'Setting up your screens',
	'Tailoring privacy & support…',
	'Making it beautiful…',
	'Almost there',
];

/** Personalized ack after the user pastes a project ID. */
export function planWelcomeMessage(mp: MasterBuildPrompt): string {
	const feats = mp.features.slice(0, 2).join(', ').toLowerCase() || 'your idea'
	const featLine = feats.charAt(0).toUpperCase() + feats.slice(1)
	return `Found “${mp.appName}” — ${mp.vibe.toLowerCase()}, for ${mp.audience.toLowerCase()}. ${featLine}. ${mp.colors} palette. Tap “Build my app” when you're ready.`
}

/** Welcome after opening a project from getappable.com (deep-link handoff). */
export function handoffWelcomeMessage(mp: MasterBuildPrompt): string {
	return planWelcomeMessage(mp)
}

/** One friendly build status line, unlocked when `atPercent` is reached. */
export interface BuildAppStep {
	label: string;
	atPercent: number;
}

/** Build steps tailored to the plan — mapped to engine % milestones. */
export function buildAppSteps(mp?: MasterBuildPrompt | null): BuildAppStep[] {
	const name = mp?.appName
	const vibe = mp?.vibe?.toLowerCase()
	const palette = mp?.colors?.split('&')[0]?.trim().toLowerCase()
	const screens = mp?.screens?.filter(Boolean).slice(0, 3) ?? []

	const steps: BuildAppStep[] = [
		{ label: 'Pulling your saved plan ✨', atPercent: 0 },
		{ label: name ? `Loading “${name}”` : 'Loading your plan', atPercent: 6 },
		{ label: vibe ? `Setting the ${vibe} feel` : 'Setting your vibe', atPercent: 12 },
		{ label: 'Sketching screen layouts', atPercent: 18 },
		{ label: 'Designing your onboarding', atPercent: 24 },
	]

	if (screens[0]) { steps.push({ label: `Building ${screens[0]}`, atPercent: 32 }) }
	if (screens[1]) { steps.push({ label: `Building ${screens[1]}`, atPercent: 40 }) }
	if (screens[2]) { steps.push({ label: `Building ${screens[2]}`, atPercent: 46 }) }
	else { steps.push({ label: 'Building your main screens', atPercent: 42 }) }

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
	)
	return steps
}

export function buildStepIndex(percent: number, steps: BuildAppStep[]): number {
	let idx = 0
	for (let i = 0; i < steps.length; i++) {
		if (percent >= steps[i].atPercent) { idx = i }
	}
	return idx
}

function hashPick(seed: string, options: string[]): string {
	let h = 0
	for (let i = 0; i < seed.length; i++) {
		h = (h * 31 + seed.charCodeAt(i)) | 0
	}
	return options[Math.abs(h) % options.length]
}

function answerSnippet(answer: string, max = 56): string {
	const first = answer.trim().split(/[.!?\n]/)[0]?.trim() ?? ''
	if (!first) return ''
	if (first.length <= max) return first
	const cut = first.slice(0, max)
	const lastSpace = cut.lastIndexOf(' ')
	return (lastSpace > 14 ? cut.slice(0, lastSpace) : cut).trim()
}

function hookPhrase(answer: string): string {
	const a = answer.toLowerCase()
	if (/dog\s*walk|walker|pet\s*sit/.test(a)) return 'dog walkers'
	if (/connect|match|link/.test(a) && /area|location|nearby|local|neighborhood/.test(a)) return 'by area'
	if (/recipe|dish|meal|cook/.test(a) && /photo|camera|snap/.test(a)) return 'from a photo'
	if (/flight|travel|trip/.test(a)) return 'finding flights'
	if (/book|appointment|schedule/.test(a)) return 'booking'
	const bit = answerSnippet(answer, 40)
	return bit.length > 6 ? bit : ''
}

function warmFromAnswer(
	questionId: InterviewQuestionId,
	answer: string,
	prior?: Partial<InterviewAnswers>
): string {
	const a = answer.toLowerCase()
	const hook = hookPhrase(answer)
	const idea = (prior?.idea ?? '').toLowerCase()
	const seed = `${questionId}:${answer}`

	if (questionId === 'idea') {
		if (/dog|pet|puppy/.test(a) && /walk|walker|sitter|sit/.test(a)) {
			return hashPick(seed, [
				'Wait a dog walker app that matches by neighborhood?? People would actually use that.',
				"Okay connecting dog walkers to owners nearby — that's such a real problem.",
				"Dog walkers + people in their area on one app — yeah that's needed.",
			])
		}
		if (/connect|match|marketplace|link/.test(a) && /area|location|nearby|local|neighborhood/.test(a)) {
			return hashPick(seed, [
				"Oh matching people by area — that's what makes this actually work.",
				'Yeah the local piece is everything for something like this.',
				'Connecting nearby instead of random — smart angle.',
			])
		}
		if (/recipe|dish|food|meal|cook/.test(a) && /photo|pic|camera|snap|picture/.test(a)) {
			return hashPick(seed, [
				"Wait snap a dish and get the recipe?? That's so useful.",
				'Photo → recipe is one of those ideas that just clicks.',
			])
		}
		if (hook) {
			return hashPick(seed, [
				`Wait ${hook} — that's actually a really clear idea.`,
				`Okay ${hook} — I can totally picture the app.`,
			])
		}
		return hashPick(seed, [
			"Wait that's actually such a good idea.",
			"Okay yeah tell me more — I'm already picturing it.",
		])
	}

	if (questionId === 'audience') {
		if (/dog|pet|owner/.test(a) && /dog|pet|walk/.test(idea)) {
			return hashPick(seed, [
				"Yeah busy dog owners who don't have time to walk — that's the person.",
				'Okay pet parents in your area — makes total sense for this.',
			])
		}
		if (answerSnippet(answer, 36).length > 8) {
			return hashPick(seed, [
				`Yeah ${answerSnippet(answer, 36)} — I can picture them opening this.`,
				`Okay so ${answerSnippet(answer, 32)} — makes sense for what you described.`,
			])
		}
		return hashPick(seed, [
			"Yeah I can totally picture who'd use this.",
			"Okay that helps — I know who we're building for now.",
		])
	}

	if (questionId === 'features') {
		const isFlow =
			a.split(/\s+/).length >= 10 &&
			(/apply|match|vice versa|then|or you can/.test(a) ||
				((a.match(/,/g)?.length ?? 0) >= 2 && /put|post|enter/.test(a)))
		if (
			isFlow &&
			/breed|dog/.test(a) &&
			/area|location/.test(a) &&
			/pay|price|budget/.test(a) &&
			/apply|match/.test(a)
		) {
			return hashPick(seed, [
				"Wait owners post breed + area + pay and walkers apply? That's the whole loop.",
				'Okay and it works both ways — owners or walkers can match. Smart.',
			])
		}
		if (isFlow) {
			return hashPick(seed, [
				'Okay yeah I can follow that whole flow — super clear.',
				"Wait that's literally the journey from open to done. Love it.",
			])
		}
		const items = answer
			.split(/[,;]|\band\b/i)
			.map((s) => s.trim())
			.filter((s) => s.length > 2 && s.split(/\s+/).length <= 10)
		if (items.length >= 2) {
			const a0 = items[0].split(/\s+/).slice(0, 5).join(' ').toLowerCase()
			const a1 = items[1].split(/\s+/).slice(0, 5).join(' ').toLowerCase()
			return hashPick(seed, [
				`Okay ${a0}, ${a1} — solid combo.`,
				`Yeah ${a0} plus ${a1} — covers the main use cases.`,
			])
		}
		return hashPick(seed, [
			'Yeah those features together actually tell a story.',
			"Okay that combo makes sense for what you're building.",
		])
	}

	if (questionId === 'name') {
		if (/suggest|you pick|name it|surprise/i.test(a)) {
			return hashPick(seed, [
				"Okay I'll cook up something that fits the vibe.",
				"On it — I'll find a name that actually sounds like your app.",
			])
		}
		const n = answer.trim()
		if (n.length > 1) return hashPick(seed, [`${n} — yeah that lands.`, `Wait ${n} is actually really good.`])
		return "Okay yeah we'll find the perfect name."
	}

	if (questionId === 'colors') {
		if (/surprise|you pick|idk|don't know|anything/.test(a)) {
			return "On it — I'll pick colors that fit your app."
		}
		const bit = answerSnippet(answer)
		if (bit.length > 3) return hashPick(seed, [`${bit} — yeah that fits.`, `Ooh ${bit} — nice pick.`])
		return 'Those colors will look great.'
	}

	return hashPick(seed, ['Got it — building on that.', 'Yeah that helps — keeping going.'])
}

/** One personal ack after every answer (matches web interview). */
export function interviewAcks(
	questionId: InterviewQuestionId,
	answer: string,
	prior?: Partial<InterviewAnswers>
): string[] {
	return [warmFromAnswer(questionId, answer, prior)]
}

function ctxFromAnswers(answers: Partial<InterviewAnswers>): string {
	return `${answers.idea ?? ''} ${answers.audience ?? ''}`.toLowerCase();
}

export function suggestColorOptions(answers: Partial<InterviewAnswers>): string[] {
	const ctx = ctxFromAnswers(answers);

	if (/recipe|food|cook|meal|kitchen|dish|grocery|ingredient/.test(ctx)) {
		return ['Sage green & warm cream', 'Terracotta & soft white', 'Surprise me'];
	}
	if (/fitness|workout|health|run|gym|sport/.test(ctx)) {
		return ['Electric teal & charcoal', 'Coral energy & off-white', 'Surprise me'];
	}
	if (/finance|money|bank|budget|invest|stock/.test(ctx)) {
		return ['Deep navy & gold', 'Forest green & cream', 'Surprise me'];
	}
	if (/social|chat|friend|community|dating|connect/.test(ctx)) {
		return ['Coral & warm sand', 'Lavender & cream', 'Surprise me'];
	}
	if (/kid|child|parent|mom|family|play|learn|student/.test(ctx)) {
		return ['Sunny yellow & sky blue', 'Peach & soft mint', 'Surprise me'];
	}
	if (/photo|camera|video|film|creative|art/.test(ctx)) {
		return ['Charcoal & coral accent', 'Deep plum & cream', 'Surprise me'];
	}
	return ['Coral & warm cream', 'Sage & soft white', 'Surprise me'];
}

export function inferVibe(answers: Partial<InterviewAnswers>): Vibe {
	const ctx = ctxFromAnswers(answers);

	if (/luxury|fashion|jewel|premium|vip|exclusive|boutique/.test(ctx)) return 'Luxury';
	if (/recipe|food|cook|meal|kitchen|grocery|mom|parent|family|baby|journal|calm|wellness|meditat|yoga|sleep/.test(ctx)) {
		return 'Soft';
	}
	if (/game|bet|crypto|stock|trade|finance|bank|money|pro|business|saas|productivity|fitness|workout|gym/.test(ctx)) {
		return 'Bold';
	}
	if (/photo|video|film|movie|music|art|design|portfolio|creative|travel|story/.test(ctx)) return 'Cinematic';
	return 'Minimal';
}

export function resolveColors(answer: string, answers: Partial<InterviewAnswers>): string {
	const a = answer.trim();
	if (!/surprise|you pick|pick for me|idk|don't know|anything/i.test(a)) return a;

	const ctx = ctxFromAnswers(answers);

	if (/recipe|food|cook|meal|kitchen|dish|grocery/.test(ctx)) {
		return 'Sage green, warm cream, soft terracotta accents';
	}
	if (/fitness|workout|health|gym/.test(ctx)) {
		return 'Fresh teal, clean white, energetic coral highlights';
	}
	if (/finance|money|bank|budget/.test(ctx)) {
		return 'Deep navy, warm gold, clean off-white';
	}
	if (/social|chat|friend|community/.test(ctx)) {
		return 'Warm coral, soft sand, gentle lavender accents';
	}
	if (/kid|child|parent|mom|family|learn/.test(ctx)) {
		return 'Sunny yellow, sky blue, soft peach';
	}
	if (/photo|camera|video|creative|art/.test(ctx)) {
		return 'Charcoal, coral accent, warm cream';
	}
	return 'Appable coral, warm cream, soft charcoal accents';
}

export function suggestAppNameFromIdea(idea: string): string {
	const lower = idea.toLowerCase();

	if (/recipe|dish|food|cook|meal/.test(lower) && /photo|pic|camera|snap|picture|roll/.test(lower)) {
		return 'SnapChef';
	}
	if (/recipe|dish|food|cook/.test(lower)) return 'DishLink';
	if (/fitness|workout|gym/.test(lower)) return 'FitFlow';

	const stop = /^(the|and|for|you|your|with|from|that|this|have|give|also|can|make|take|get|pic|photo|a)$/i;
	const words = idea
		.replace(/[^a-zA-Z0-9 ]/g, ' ')
		.split(/\s+/)
		.filter((w) => w.length > 2 && !stop.test(w));

	if (words.length >= 2) {
		return words
			.slice(0, 2)
			.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
			.join('');
	}
	if (words.length === 1) {
		const w = words[0];
		return w[0].toUpperCase() + w.slice(1).toLowerCase();
	}
	return 'My App';
}

export function resolveAppName(answers: Partial<InterviewAnswers>): string {
	const nameAnswer = (answers.name ?? '').trim();
	const idea = answers.idea ?? '';

	if (nameAnswer && !/suggest|you pick|name it|idk|don't know|pick one|surprise/i.test(nameAnswer)) {
		return nameAnswer.slice(0, 30).trim();
	}
	return suggestAppNameFromIdea(idea);
}
