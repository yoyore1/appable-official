/*--------------------------------------------------------------------------------------
 *  Idea-aware interview tailoring — ported from web `interviewUnderstanding.ts`.
 *--------------------------------------------------------------------------------------*/

import { answerFor } from './appableInterviewHelpers.js';
import type { InterviewStepId } from './appableInterviewFlow.js';
import type { InterviewTurn } from './appableBuilderTypes.js';

export type InterviewNicheCategory =
	| 'dog-pets'
	| 'marketplace'
	| 'fitness'
	| 'food'
	| 'travel'
	| 'booking'
	| 'habits'
	| 'alarm-wake'
	| 'finance'
	| 'social'
	| 'generic';

function ctx(interview: InterviewTurn[]): string {
	return interview.map((t) => `${t.question} ${t.answer}`).join(' ').toLowerCase();
}

export function detectInterviewNiche(interview: InterviewTurn[]): InterviewNicheCategory {
	const c = ctx(interview);
	if (/dog|pet|puppy|paw|walker|walk your|dog walk|dog owner/.test(c)) { return 'dog-pets'; }
	if (/alarm|snooze|wake up|wake-up|oversleep|sunlight|sun.?light|morning light|outside.*photo|photo.*outside|picture.*sun/.test(c)) {
		return 'alarm-wake';
	}
	if (/connect|match|marketplace|apply|gig|freelance|local|nearby|area/.test(c)) { return 'marketplace'; }
	if (/recipe|food|cook|meal|kitchen|dish|ingredient|grocery/.test(c)) { return 'food'; }
	if (/fitness|workout|gym|health|run|exercise/.test(c)) { return 'fitness'; }
	if (/flight|travel|trip|hotel|vacation/.test(c)) { return 'travel'; }
	if (/book|appointment|schedule|calendar|reserv/.test(c)) { return 'booking'; }
	if (/habit|streak|routine|daily|journal/.test(c)) { return 'habits'; }
	if (/finance|money|budget|bank|invest|expense/.test(c)) { return 'finance'; }
	if (/social|chat|friend|community|dating|message/.test(c)) { return 'social'; }
	return 'generic';
}

export function ideaTailoredSuggestions(stepId: InterviewStepId, interview: InterviewTurn[]): string[] | null {
	const idea = answerFor(interview, 'idea');
	if (!idea.trim()) { return null; }
	const niche = detectInterviewNiche(interview);

	if (stepId === 'audience' || stepId === 'pool_who') {
		if (niche === 'alarm-wake') {
			return ['Heavy snoozers who need a real wake-up', 'Shift workers with brutal early alarms', 'Students who sleep through normal alarms'];
		}
		if (niche === 'dog-pets') {
			return ['Busy dog owners who need walks', 'Dog walkers looking for local gigs', 'Both owners & walkers in the same area'];
		}
		if (niche === 'habits') {
			return ['People building morning routines', 'Anyone trying to quit snoozing', 'Students staying consistent daily'];
		}
		if (niche === 'fitness') {
			return ['Gym regulars tracking progress', 'Beginners starting a routine', 'Runners logging miles'];
		}
	}

	if (stepId === 'features' || stepId === 'pool_core_loop') {
		if (niche === 'alarm-wake') {
			return ['Set alarm → must snap outside/sun photo to stop', 'No snooze — only photo proof dismisses it', 'Wake streaks + history of on-time dismissals'];
		}
		if (niche === 'dog-pets') {
			return ['Post breed, area & pay → walkers apply', 'Browse nearby requests & match both ways', 'Chat, walk history & in-app payments'];
		}
		if (niche === 'habits' || niche === 'fitness') {
			return ['Quick daily check-in', 'Streak counter & progress chart', 'Reminders to stay on track'];
		}
	}

	if (stepId === 'name' && niche === 'alarm-wake') {
		return ['SunStop', 'RiseSnap', 'NoSnooze'];
	}

	return null;
}
