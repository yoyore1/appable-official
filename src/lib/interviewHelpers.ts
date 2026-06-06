import type { InterviewTurn, Vibe } from "@/lib/types";

export function answerFor(interview: InterviewTurn[], id: string): string {
  return interview.find((t) => t.questionId === id)?.answer ?? "";
}

/** Infer aesthetic from what they're building — no separate vibe question. */
export function inferVibe(interview: InterviewTurn[]): Vibe {
  const ctx = `${answerFor(interview, "idea")} ${answerFor(interview, "audience")}`.toLowerCase();

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

/** Palette chips shown above the colors question input. */
export function suggestColorOptions(interview: InterviewTurn[]): string[] {
  const ctx = `${answerFor(interview, "idea")} ${answerFor(interview, "audience")}`.toLowerCase();

  if (/recipe|food|cook|meal|kitchen|dish|grocery|ingredient/.test(ctx)) {
    return ["Sage green & warm cream", "Terracotta & soft white", "Surprise me"];
  }
  if (/fitness|workout|health|run|gym|sport/.test(ctx)) {
    return ["Electric teal & charcoal", "Coral energy & off-white", "Surprise me"];
  }
  if (/finance|money|bank|budget|invest|stock/.test(ctx)) {
    return ["Deep navy & gold", "Forest green & cream", "Surprise me"];
  }
  if (/social|chat|friend|community|dating|connect/.test(ctx)) {
    return ["Coral & warm sand", "Lavender & cream", "Surprise me"];
  }
  if (/kid|child|parent|mom|family|play|learn|student/.test(ctx)) {
    return ["Sunny yellow & sky blue", "Peach & soft mint", "Surprise me"];
  }
  if (/photo|camera|video|film|creative|art/.test(ctx)) {
    return ["Charcoal & coral accent", "Deep plum & cream", "Surprise me"];
  }
  return ["Coral & warm cream", "Sage & soft white", "Surprise me"];
}

/** Map "surprise me" to a palette that fits the app. */
export function resolveColors(answer: string, interview: InterviewTurn[]): string {
  const a = answer.trim();
  if (!/surprise|you pick|pick for me|idk|don't know|anything/i.test(a)) return a;

  const ctx = `${answerFor(interview, "idea")} ${answerFor(interview, "audience")}`.toLowerCase();

  if (/recipe|food|cook|meal|kitchen|dish|grocery/.test(ctx)) {
    return "Sage green, warm cream, soft terracotta accents";
  }
  if (/fitness|workout|health|gym/.test(ctx)) {
    return "Fresh teal, clean white, energetic coral highlights";
  }
  if (/finance|money|bank|budget/.test(ctx)) {
    return "Deep navy, warm gold, clean off-white";
  }
  if (/social|chat|friend|community/.test(ctx)) {
    return "Warm coral, soft sand, gentle lavender accents";
  }
  if (/kid|child|parent|mom|family|learn/.test(ctx)) {
    return "Sunny yellow, sky blue, soft peach";
  }
  if (/photo|camera|video|creative|art/.test(ctx)) {
    return "Charcoal, coral accent, warm cream";
  }
  return "Appable coral, warm cream, soft charcoal accents";
}

/** Suggest a real app name from the idea (avoids "TakeA" from "take a pic"). */
export function suggestAppNameFromIdea(idea: string): string {
  const lower = idea.toLowerCase();

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

  if (nameAnswer && !/suggest|you pick|name it|idk|don't know|pick one|surprise/i.test(nameAnswer)) {
    return nameAnswer.slice(0, 30).trim();
  }
  return suggestAppNameFromIdea(idea);
}
