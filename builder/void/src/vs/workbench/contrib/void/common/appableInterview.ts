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
	{ id: 'features', prompt: 'What are the 3 main things it does?', kind: 'text' },
	{ id: 'name', prompt: 'What do you want to call it? (Or say "suggest one" and I\'ll name it.)', kind: 'text' },
	{ id: 'colors', prompt: 'Last one — pick a palette that feels right, or tap Surprise me:', kind: 'choice' },
];

export const BUILDING_STEPS = [
	'Reading your idea ✨',
	'Designing your onboarding',
	'Setting up your screens',
	'Making it beautiful…',
	'Almost there',
];

/** Personalized ack after the user pastes a project ID. */
export function planWelcomeMessage(mp: MasterBuildPrompt): string {
	const feats = mp.features.slice(0, 2).join(', ').toLowerCase() || 'your idea'
	const featLine = feats.charAt(0).toUpperCase() + feats.slice(1)
	return `Found “${mp.appName}” — ${mp.vibe.toLowerCase()}, for ${mp.audience.toLowerCase()}. ${featLine}. ${mp.colors} palette. Tap “Build my app” when you're ready.`
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

const HYPE_LINE: Record<InterviewQuestionId, string> = {
	idea: 'Love it.',
	audience: 'Perfect.',
	features: 'Love those.',
	name: 'Love it.',
	colors: 'Gorgeous.',
};

function answerSnippet(answer: string, max = 34): string {
	return (
		answer
			.trim()
			.split(/[.!?\n]/)[0]
			?.slice(0, max)
			.trim()
			.toLowerCase() ?? ''
	);
}

function warmFromAnswer(questionId: InterviewQuestionId, answer: string): string {
	const a = answer.toLowerCase();
	const bit = answerSnippet(answer);

	if (questionId === 'idea') {
		if (
			(/recipe|dish|food|meal|cook|ingredient/.test(a)) &&
			(/photo|pic|camera|picture|snap|roll|gallery/.test(a))
		) {
			return "Wait snap a dish and get the recipe?? That's so useful.";
		}
		if (bit.length > 8) return `Okay ${bit} — I kind of love that.`;
		return "Wait that's actually such a good idea.";
	}

	if (questionId === 'audience') {
		if (/mom|mother|parent/.test(a) && /young|adult|teen|cook|learn/.test(a)) {
			return "Okay moms + people learning to cook — that's such a real niche.";
		}
		if (/young|teen|student|adult|beginner|busy/.test(a) && bit.length > 6) {
			return `Yeah ${bit} — totally get who you mean.`;
		}
		if (bit.length > 6) return `Okay ${bit} — makes total sense who this is for.`;
		return "Yeah I can totally picture who'd use this.";
	}

	if (questionId === 'features') {
		const first = answer.split(/[,;]|\band\b/i)[0]?.trim().toLowerCase();
		if (first && first.length > 4) {
			return `Okay ${first} — that's a solid core feature.`;
		}
		if (bit.length > 6) return `Love that it does ${bit}.`;
		return 'Yeah those are exactly the right things.';
	}

	if (questionId === 'name') {
		if (/suggest|you pick|name it|surprise/i.test(a)) {
			return "Okay I'll cook up the perfect name for this.";
		}
		const n = answer.trim();
		if (n.length > 1) return `${n} — that's a great name.`;
		return "Okay yeah we'll find the perfect name.";
	}

	if (questionId === 'colors') {
		if (/surprise|you pick|idk|don't know|anything/.test(a)) {
			return "Okay I'll make it look incredible — trust me.";
		}
		if (bit.length > 3) return `Ooh ${bit} — that's going to be beautiful.`;
		return 'Okay those colors are going to eat.';
	}

	return bit.length > 6 ? `Okay ${bit} — love that.` : "Okay yeah I'm into this.";
}

/** Two-bubble ack after every answer (matches web interview). */
export function interviewAcks(questionId: InterviewQuestionId, answer: string): string[] {
	return [warmFromAnswer(questionId, answer), HYPE_LINE[questionId]];
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
