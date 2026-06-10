/*--------------------------------------------------------------------------------------
 *  Interview helpers — ported from web `interviewHelpers.ts`.
 *--------------------------------------------------------------------------------------*/

import { isDeferToRecommendation, profileFromInterview } from './appableDesignResearch.js';
import type { InterviewTurn, Vibe } from './appableBuilderTypes.js';

export function answerFor(interview: InterviewTurn[], id: string): string {
	return interview.find((t) => t.questionId === id)?.answer ?? '';
}

export function interviewContext(interview: InterviewTurn[]): string {
	return [
		answerFor(interview, 'idea'),
		answerFor(interview, 'twist'),
		answerFor(interview, 'reference_name'),
		answerFor(interview, 'audience'),
		answerFor(interview, 'features'),
	].filter(Boolean).join(' ');
}

export function inferVibe(interview: InterviewTurn[]): Vibe {
	const ctx = interviewContext(interview).toLowerCase();
	if (/luxury|fashion|jewel|premium|vip|exclusive|boutique/.test(ctx)) { return 'Luxury'; }
	if (/recipe|food|cook|meal|kitchen|grocery|mom|parent|family|baby|journal|calm|wellness|meditat|yoga|sleep/.test(ctx)) {
		return 'Soft';
	}
	if (/game|bet|crypto|stock|trade|finance|bank|money|pro|business|saas|productivity|fitness|workout|gym/.test(ctx)) {
		return 'Bold';
	}
	if (/photo|video|film|movie|music|art|design|portfolio|creative|travel|story/.test(ctx)) { return 'Cinematic'; }
	return 'Minimal';
}

export function resolveColors(answer: string, interview: InterviewTurn[]): string {
	const a = answer.trim();
	const profile = profileFromInterview(interview);
	if (a && !isDeferToRecommendation(a) && !/no preference|skip|none/i.test(a)) {
		if (a === profile.colorsShort) { return profile.colors; }
		return a;
	}
	return profile.colors;
}

export function suggestAppNameFromIdea(idea: string): string {
	const lower = idea.toLowerCase();
	if (/dog|pet|walk|walker|paw/.test(lower)) {
		const names = ['PawPath', 'WalkMatch', 'Neighborhood Paws'];
		let h = 0;
		for (const ch of idea) { h = (h * 31 + ch.charCodeAt(0)) | 0; }
		return names[Math.abs(h) % names.length];
	}
	if (/recipe|dish|food|cook|meal/.test(lower) && /photo|pic|camera|snap|picture|roll/.test(lower)) {
		return 'SnapChef';
	}
	if (/recipe|dish|food|cook/.test(lower)) { return 'DishLink'; }
	if (/fitness|workout|gym/.test(lower)) { return 'FitFlow'; }
	if (/budget|money|finance|expense/.test(lower)) { return 'PocketPlan'; }
	if (/habit|track|routine/.test(lower)) { return 'DailyFlow'; }
	if (/social|friend|chat|connect/.test(lower)) { return 'CircleUp'; }

	const stop = /^(the|and|for|you|your|with|from|that|this|have|give|also|can|make|take|get|pic|photo|a)$/i;
	const words = idea.replace(/[^a-zA-Z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !stop.test(w));
	if (words.length >= 2) {
		return words.slice(0, 2).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
	}
	if (words.length === 1) {
		const w = words[0];
		return w[0].toUpperCase() + w.slice(1).toLowerCase();
	}
	return 'My App';
}

export function resolveAppName(interview: InterviewTurn[]): string {
	const nameAnswer = answerFor(interview, 'name').trim();
	const idea = answerFor(interview, 'idea');
	if (nameAnswer && !/suggest|you pick|name it|idk|don't know|pick one|surprise/i.test(nameAnswer)) {
		return nameAnswer.slice(0, 30).trim();
	}
	return suggestAppNameFromIdea(idea);
}
