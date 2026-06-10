import { answerFor } from "@/lib/interviewHelpers";
import {
  detectInterviewNiche,
  isConfusingIdea,
  isVagueIdea,
  mentionsAudienceInIdea,
} from "@/lib/interviewUnderstanding";
import { hasDetailedFlow } from "@/lib/dynamicInterview";
import type { InterviewTurn } from "@/lib/types";

/** Curated interview pool — Kimi picks 0–2 per app (no monetization). */
export type PoolQuestionId =
  | "pool_who"
  | "pool_core_loop"
  | "pool_rules"
  | "pool_proof"
  | "pool_first_use";

export const POOL_QUESTION_IDS: PoolQuestionId[] = [
  "pool_who",
  "pool_core_loop",
  "pool_rules",
  "pool_proof",
  "pool_first_use",
];

export interface PoolQuestionDef {
  id: PoolQuestionId;
  /** Fills in {term} {niche} from the idea when personalizing. */
  prompt: string;
  kind: "text";
  multiPick?: boolean;
}

export const POOL_QUESTIONS: Record<PoolQuestionId, PoolQuestionDef> = {
  pool_who: {
    id: "pool_who",
    kind: "text",
    prompt: "Who's the target audience?",
  },
  pool_core_loop: {
    id: "pool_core_loop",
    kind: "text",
    multiPick: true,
    prompt: "What are 2–3 main things it does?",
  },
  pool_rules: {
    id: "pool_rules",
    kind: "text",
    prompt:
      "Any hard rules we should lock in — what's required, optional, or not allowed?",
  },
  pool_proof: {
    id: "pool_proof",
    kind: "text",
    prompt:
      "How should the app verify they actually did it — photo, scan, GPS, or something else?",
  },
  pool_first_use: {
    id: "pool_first_use",
    kind: "text",
    prompt:
      "Someone opens it for the first time — what's the first thing they do, and what do they get out of it?",
  },
};

export function isPoolStepId(id: string): id is PoolQuestionId {
  return (POOL_QUESTION_IDS as readonly string[]).includes(id);
}

function lacksHardRules(idea: string): boolean {
  return !/must|require|only|no snooze|can't|cannot|disabled|verify|proof|not allowed|without/.test(
    idea.toLowerCase()
  );
}

function hasFeatureSignals(idea: string): boolean {
  const l = idea.toLowerCase();
  return (
    hasDetailedFlow(idea) ||
    /→|->|then|and also|plus|feature|track|save|share|post|book|match|chat|alarm|photo|snooze|streak|list|browse/.test(
      l
    )
  );
}

export type PoolGapMap = Record<PoolQuestionId, boolean>;

/** Which pool questions could still help — rules only, no LLM. */
export function assessPoolGaps(interview: InterviewTurn[]): PoolGapMap {
  const idea = answerFor(interview, "idea");
  const l = idea.toLowerCase();
  const niche = detectInterviewNiche(interview);

  const answered = (id: PoolQuestionId) => Boolean(answerFor(interview, id));

  return {
    pool_first_use:
      !answered("pool_first_use") &&
      (isVagueIdea(idea, 6) || isConfusingIdea(idea)),
    pool_core_loop:
      !answered("pool_core_loop") &&
      !answerFor(interview, "features") &&
      !hasFeatureSignals(idea),
    pool_who:
      !answered("pool_who") &&
      !answerFor(interview, "audience") &&
      !mentionsAudienceInIdea(idea),
    pool_rules:
      !answered("pool_rules") &&
      (niche === "alarm-wake" ||
        /verify|proof|photo|camera|scan|must|require/.test(l)) &&
      lacksHardRules(idea),
    pool_proof:
      !answered("pool_proof") &&
      /photo|camera|snap|picture|scan|gps|location|verify|proof/.test(l) &&
      lacksHardRules(idea),
  };
}

const POOL_PRIORITY: PoolQuestionId[] = [
  "pool_first_use",
  "pool_core_loop",
  "pool_who",
  "pool_rules",
  "pool_proof",
];

/** Rule-based pick (max 2) — used as fallback and before Kimi enriches. */
export function selectPoolQuestionsSync(interview: InterviewTurn[]): PoolQuestionId[] {
  const gaps = assessPoolGaps(interview);
  const picked: PoolQuestionId[] = [];
  for (const id of POOL_PRIORITY) {
    if (gaps[id]) {
      picked.push(id);
      if (picked.length >= 2) break;
    }
  }
  return picked;
}

export function personalizePoolPrompt(
  id: PoolQuestionId,
  interview: InterviewTurn[]
): string {
  const idea = answerFor(interview, "idea");
  const niche = detectInterviewNiche(interview);
  const base = POOL_QUESTIONS[id].prompt;

  if (id === "pool_who") {
    if (niche === "alarm-wake") {
      return "Who needs this most — heavy snoozers, shift workers, or students who oversleep?";
    }
    if (niche === "dog-pets") {
      return "Who's the target audience — dog owners, walkers, or both?";
    }
    if (niche === "marketplace") {
      return "Who's this for — people offering help nearby, people who need it, or both?";
    }
    if (niche === "habits" || niche === "fitness") {
      return "Who's the target audience — people already into it, beginners, or both?";
    }
    return base;
  }

  if (id === "pool_core_loop") {
    if (niche === "alarm-wake") {
      return "What are 2–3 main things it does — set alarm, photo to dismiss, streaks…?";
    }
    if (niche === "dog-pets") {
      return "What are 2–3 main things it does — post walks, match walkers, chat…?";
    }
    if (niche === "habits" || niche === "fitness") {
      return "What are 2–3 main things it does — log progress, streaks, reminders…?";
    }
    return base;
  }

  if (id === "pool_rules" && niche === "alarm-wake") {
    return "Any hard rules — no snooze, must be a real outdoor/sun photo, no gallery uploads?";
  }

  if (id === "pool_proof" && /photo|camera|sun|outside/.test(idea.toLowerCase())) {
    return "How should photo proof work — real camera only, detect daylight, or something else?";
  }

  if (id === "pool_first_use" && idea.length > 8) {
    return `For your idea — someone opens it the first time. What's the first thing they do?`;
  }

  return base;
}

export function resolvePoolStep(
  id: PoolQuestionId,
  interview: InterviewTurn[]
): PoolQuestionDef & { prompt: string } {
  const def = POOL_QUESTIONS[id];
  return {
    ...def,
    prompt: personalizePoolPrompt(id, interview),
  };
}
