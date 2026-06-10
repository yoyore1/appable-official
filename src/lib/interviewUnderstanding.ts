import { answerFor } from "@/lib/interviewHelpers";
import type { InterviewStepId } from "@/lib/interviewFlow";
import type { InterviewTurn } from "@/lib/types";
import { APPABLE_PICK } from "@/lib/interviewSuggestions";

export type InterviewNicheCategory =
  | "dog-pets"
  | "marketplace"
  | "fitness"
  | "food"
  | "travel"
  | "booking"
  | "habits"
  | "alarm-wake"
  | "finance"
  | "social"
  | "generic";

function ctx(interview: InterviewTurn[]): string {
  return interview.map((t) => `${t.question} ${t.answer}`).join(" ").toLowerCase();
}

export function detectInterviewNiche(interview: InterviewTurn[]): InterviewNicheCategory {
  const c = ctx(interview);
  if (/dog|pet|puppy|paw|walker|walk your|dog walk|dog owner/.test(c)) return "dog-pets";
  if (/alarm|snooze|wake up|wake-up|oversleep|sunlight|sun.?light|morning light|outside.*photo|photo.*outside|picture.*sun/.test(c)) {
    return "alarm-wake";
  }
  if (/connect|match|marketplace|apply|gig|freelance|local|nearby|area/.test(c)) {
    return "marketplace";
  }
  if (/recipe|food|cook|meal|kitchen|dish|ingredient|grocery/.test(c)) return "food";
  if (/fitness|workout|gym|health|run|exercise/.test(c)) return "fitness";
  if (/flight|travel|trip|hotel|vacation/.test(c)) return "travel";
  if (/book|appointment|schedule|calendar|reserv/.test(c)) return "booking";
  if (/habit|streak|routine|daily|journal/.test(c)) return "habits";
  if (/finance|money|budget|bank|invest|expense/.test(c)) return "finance";
  if (/social|chat|friend|community|dating|message/.test(c)) return "social";
  return "generic";
}

export function isNicheIdea(idea: string): boolean {
  const l = idea.toLowerCase();
  return (
    detectInterviewNiche([{ questionId: "idea", question: "", answer: idea }]) !== "generic" ||
    /photo|camera|verify|proof|scan|gps|map|alarm|snooze|streak|match|both sides|owner|walker/.test(l)
  );
}

export function ideaKeyTerms(idea: string): string[] {
  const stop = new Set([
    "app",
    "that",
    "with",
    "have",
    "instead",
    "your",
    "they",
    "their",
    "when",
    "what",
    "where",
    "need",
    "take",
    "stop",
    "like",
  ]);
  const words =
    idea.toLowerCase().match(/[a-z]{4,}/g)?.filter((w) => !stop.has(w)) ?? [];
  const unique: string[] = [];
  for (const w of words) {
    if (!unique.includes(w)) unique.push(w);
    if (unique.length >= 4) break;
  }
  return unique;
}

export function isVagueIdea(text: string, minWords = 5): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length < minWords;
}

export function isConfusingIdea(text: string): boolean {
  const t = text.trim();
  if (t.length < 12) return true;
  const l = t.toLowerCase();
  if (/something|anything|idk|not sure|kind of|sort of|maybe|app for/.test(l) && t.split(/\s+/).length < 10) {
    return true;
  }
  return false;
}

const GENERIC_AUDIENCE_RE =
  /everyday people|something simple|busy everyday|beginners who want|power users|people who want something|actually useful/i;

export function isGenericAudienceAnswer(answer: string): boolean {
  return GENERIC_AUDIENCE_RE.test(answer);
}

export function mentionsAudienceInIdea(idea: string): boolean {
  return /for\s+(kids|parents|students|teens|adults|owners|walkers|busy|people who|anyone who)/i.test(idea);
}

/** Rule-based clarify prompt — sync, uses their nouns. */
export function clarifyPromptForAnchor(
  anchor: "idea" | "audience" | "features",
  interview: InterviewTurn[]
): string {
  const idea = answerFor(interview, "idea");
  const niche = detectInterviewNiche(interview);

  if (anchor === "idea") {
    if (niche === "alarm-wake") {
      return "Quick check — the alarm only stops when they photograph outside or sunlight, not a normal snooze button?";
    }
    if (isConfusingIdea(idea)) {
      return "What's the one thing someone does in your app that makes it different from a normal app?";
    }
    return "Walk me through it once — someone opens your app, what's the first real thing they do?";
  }

  if (anchor === "audience") {
    if (niche === "alarm-wake") {
      return "Who needs this most — heavy snoozers, people with early shifts, or students with brutal wake-up times?";
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
    return "Who's the target audience?";
  }

  if (anchor === "features") {
    if (niche === "alarm-wake") {
      return "What has to happen when the alarm rings — camera check, no snooze, streak tracking, or all of that?";
    }
    const audience = answerFor(interview, "audience");
    if (audience) {
      return `For ${audience.split(/[,;]/)[0]?.trim() || "your users"} — what's the main thing the app does in one flow?`;
    }
    return "What's the core loop — what do they do, step by step?";
  }

  return "What should I know to build this right?";
}

export function ideaTailoredSuggestions(
  stepId: InterviewStepId,
  interview: InterviewTurn[]
): string[] | null {
  const idea = answerFor(interview, "idea");
  if (!idea.trim()) return null;
  const niche = detectInterviewNiche(interview);

  if (stepId === "audience" || stepId === "pool_who") {
    if (niche === "alarm-wake") {
      return [
        "Heavy snoozers who need a real wake-up",
        "Shift workers with brutal early alarms",
        "Students who sleep through normal alarms",
      ];
    }
    if (niche === "dog-pets") {
      return [
        "Busy dog owners who need walks",
        "Dog walkers looking for local gigs",
        "Both owners & walkers in the same area",
      ];
    }
    if (niche === "habits") {
      return [
        "People building morning routines",
        "Anyone trying to quit snoozing",
        "Students staying consistent daily",
      ];
    }
    if (niche === "fitness") {
      return [
        "Gym regulars tracking progress",
        "Beginners starting a routine",
        "Runners logging miles",
      ];
    }
  }

  if (stepId === "features" || stepId === "pool_core_loop") {
    if (niche === "alarm-wake") {
      return [
        "Set alarm → must snap outside/sun photo to stop",
        "No snooze — only photo proof dismisses it",
        "Wake streaks + history of on-time dismissals",
      ];
    }
    if (niche === "dog-pets") {
      return [
        "Post breed, area & pay → walkers apply",
        "Browse nearby requests & match both ways",
        "Chat, walk history & in-app payments",
      ];
    }
    if (niche === "habits" || niche === "fitness") {
      return [
        "Quick daily check-in",
        "Streak counter & progress chart",
        "Reminders to stay on track",
      ];
    }
  }

  if (stepId === "followup_idea" && niche === "alarm-wake") {
    return [
      "Alarm rings → open camera → snap sky or window → alarm stops",
      "Set tonight's alarm → morning photo proof required to dismiss",
      "Miss the photo → alarm keeps ringing until they get outside",
    ];
  }

  if (stepId === "followup_features" && niche === "alarm-wake") {
    return [
      "Set alarm → rings → camera opens → sun/outside photo → dismissed",
      "No snooze button — only verified photo stops it",
      "Log each successful wake-up in a streak chart",
    ];
  }

  if (stepId === "followup_recipe_depth" && niche === "alarm-wake") {
    return [
      "Must detect daylight or outdoor scene — no gallery uploads",
      "Keep snooze disabled — photo is the only way out",
      "Optional grace period before photo challenge starts",
    ];
  }

  if (stepId === "name" && niche === "alarm-wake") {
    return ["SunStop", "RiseSnap", "NoSnooze"];
  }

  if (stepId === "pool_rules" && niche === "alarm-wake") {
    return [
      "No snooze — photo is the only way out",
      "Must be a real camera shot, no gallery",
      "Optional grace period before photo challenge",
    ];
  }

  if (stepId === "pool_proof" && niche === "alarm-wake") {
    return [
      "Detect daylight or outdoor scene in photo",
      "Require window/sky visible in frame",
      "Reject dark indoor-only shots",
    ];
  }

  if (stepId === "pool_first_use" && niche === "alarm-wake") {
    return [
      "Set tonight's alarm with photo-dismiss enabled",
      "Alarm rings → camera opens → snap outside → stops",
      "See wake streak after first successful dismiss",
    ];
  }

  return null;
}

export type ClarifyAnchor = "idea" | "audience" | "features";

export function clarifyStepIdForAnchor(anchor: ClarifyAnchor): InterviewStepId {
  if (anchor === "idea") return "followup_clarify_idea";
  if (anchor === "audience") return "followup_clarify_audience";
  return "followup_clarify_features";
}

export function clarifyAnchorForStepId(stepId: string): ClarifyAnchor | null {
  if (stepId === "followup_clarify_idea") return "idea";
  if (stepId === "followup_clarify_audience") return "audience";
  if (stepId === "followup_clarify_features") return "features";
  return null;
}
