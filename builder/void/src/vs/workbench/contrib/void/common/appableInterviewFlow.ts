/*--------------------------------------------------------------------------------------
 *  Interview spine — mirrors web `interviewFlow.ts` (5 questions).
 *--------------------------------------------------------------------------------------*/

export type InterviewStepId =
	| 'idea'
	| 'audience'
	| 'features'
	| 'name'
	| 'colors'
	| 'followup_idea'
	| 'followup_features'
	| 'followup_recipe_depth'
	| 'followup_clarify_idea'
	| 'followup_clarify_audience'
	| 'followup_clarify_features'
	| 'pool_who'
	| 'pool_core_loop'
	| 'pool_rules'
	| 'pool_proof'
	| 'pool_first_use';

export interface InterviewStep {
	id: InterviewStepId;
	prompt: string;
	kind: 'text' | 'choice';
	options?: string[];
}

/** Same order and copy as web FULL_STEPS. */
export const FULL_STEPS: InterviewStep[] = [
	{ id: 'idea', prompt: "Tell me about your app — what's the idea?", kind: 'text' },
	{ id: 'audience', prompt: "Who's it for?", kind: 'text' },
	{ id: 'features', prompt: 'What are 2–3 main things it should do?', kind: 'text' },
	{ id: 'name', prompt: 'What do you want to call it?', kind: 'text' },
	{ id: 'colors', prompt: 'Pick a palette — or type your own.', kind: 'choice', options: [] },
];

export const INTERVIEW_QUESTIONS = FULL_STEPS;

export const FIRST_INTERVIEW_QUESTION = FULL_STEPS[0];

/** Shown as the last pill on every spine question (matches web). */
export const APPABLE_PICK = 'Let Appable pick';

export function getNextSpineStep(currentId: InterviewStepId): InterviewStep | null {
	const idx = FULL_STEPS.findIndex((s) => s.id === currentId);
	if (idx < 0 || idx >= FULL_STEPS.length - 1) { return null; }
	return FULL_STEPS[idx + 1];
}

export function isSpineDone(lastAnsweredId: InterviewStepId): boolean {
	return getNextSpineStep(lastAnsweredId) === null;
}
