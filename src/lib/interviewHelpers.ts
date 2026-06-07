import {
  isDeferToRecommendation,
  profileFromInterview,
} from "@/lib/designResearch";
import { suggestForStep } from "@/lib/interviewSuggestions";
import type { InterviewTurn, Vibe } from "@/lib/types";

export function answerFor(interview: InterviewTurn[], id: string): string {
  return interview.find((t) => t.questionId === id)?.answer ?? "";
}

/** Text context for palette suggestions across both interview paths. */
export function interviewContext(interview: InterviewTurn[]): string {
  return [
    answerFor(interview, "idea"),
    answerFor(interview, "twist"),
    answerFor(interview, "reference_name"),
    answerFor(interview, "audience"),
    answerFor(interview, "features"),
  ]
    .filter(Boolean)
    .join(" ");
}

/** Infer vibe from app context (no separate vibe question). */
export function resolveVibe(interview: InterviewTurn[]): Vibe {
  return inferVibe(interview);
}

/** Infer aesthetic from what they're building when vibe wasn't picked. */
export function inferVibe(interview: InterviewTurn[]): Vibe {
  const ctx = interviewContext(interview).toLowerCase();

  if (/luxury|fashion|jewel|premium|vip|exclusive|boutique/.test(ctx)) return "Luxury";
  if (/recipe|food|cook|meal|kitchen|grocery|mom|parent|family|baby|journal|calm|wellness|meditat|yoga|sleep/.test(ctx)) {
    return "Soft";
  }
  if (/game|bet|crypto|stock|trade|finance|bank|money|pro|business|saas|productivity|fitness|workout|gym/.test(ctx)) {
    return "Bold";
  }
  if (/photo|video|film|movie|music|art|design|portfolio|creative|travel|story/.test(ctx)) return "Cinematic";
  return "Minimal";
}

/** @deprecated Use suggestForStep('colors', interview). */
export function suggestColorOptions(interview: InterviewTurn[]): string[] {
  return suggestForStep("colors", interview);
}

/** Map optional / surprise picks to a palette that fits the app. */
export function resolveColors(answer: string, interview: InterviewTurn[]): string {
  const a = answer.trim();
  if (a && !isDeferToRecommendation(a) && !/no preference|skip|none/i.test(a)) {
    return a;
  }
  return profileFromInterview(interview).colors;
}

/** Suggest a real app name from the idea (avoids "TakeA" from "take a pic"). */
export function suggestAppNameFromIdea(idea: string): string {
  const lower = idea.toLowerCase();

  if (/dog|pet|walk|walker|paw/.test(lower)) {
    const names = ["PawPath", "WalkMatch", "Neighborhood Paws"];
    let h = 0;
    for (const ch of idea) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return names[Math.abs(h) % names.length];
  }
  if (/recipe|dish|food|cook|meal/.test(lower) && /photo|pic|camera|snap|picture|roll/.test(lower)) {
    return "SnapChef";
  }
  if (/recipe|dish|food|cook/.test(lower)) return "DishLink";
  if (/fitness|workout|gym/.test(lower)) return "FitFlow";
  if (/budget|money|finance|expense/.test(lower)) return "PocketPlan";
  if (/habit|track|routine/.test(lower)) return "DailyFlow";
  if (/social|friend|chat|connect/.test(lower)) return "CircleUp";

  const stop = /^(the|and|for|you|your|with|from|that|this|have|give|also|can|make|take|get|pic|photo|pic of|a)$/i;
  const words = idea
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stop.test(w));

  if (words.length >= 2) {
    return words
      .slice(0, 2)
      .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
      .join("");
  }
  if (words.length === 1) {
    const w = words[0];
    return w[0].toUpperCase() + w.slice(1).toLowerCase();
  }
  return "My App";
}

export function resolveAppName(interview: InterviewTurn[]): string {
  const nameAnswer = answerFor(interview, "name").trim();
  const idea = answerFor(interview, "idea");
  const twist = answerFor(interview, "twist");

  if (nameAnswer && !/suggest|you pick|name it|idk|don't know|pick one|surprise/i.test(nameAnswer)) {
    return nameAnswer.slice(0, 30).trim();
  }
  return suggestAppNameFromIdea(idea || twist);
}
