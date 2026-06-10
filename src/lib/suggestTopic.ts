/** Normalize landing-page idea input before suggest cards or archetype picks. */
export function normalizeSuggestTopic(raw: string): string {
  let t = raw.trim().toLowerCase();
  if (!t) return raw.trim();

  const leadingFiller =
    /^(a|an|the|my|some|brand|new|unique|original|cool|simple|basic|great|different|fresh|modern)\s+/;
  while (leadingFiller.test(t)) {
    t = t.replace(leadingFiller, "").trim();
  }

  t = t
    .replace(/\b(mobile\s+)?app(lication)?\b/gi, "")
    .replace(/\b(idea|concept|platform|tool)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/\bhabit\s*track/.test(t) || t === "habit tracker" || t === "habits") {
    return "daily habits";
  }
  if (/\bworkout|fitness|gym\b/.test(t)) return "workouts and fitness";
  if (/\bdog|pet|walk/.test(t)) return "dog walking";
  if (/\bmeal|recipe|cook|food\b/.test(t)) return "home cooking";
  if (/\bbudget|money|finance\b/.test(t)) return "personal budgeting";
  if (/\bjournal|diary|note/.test(t)) return "daily journaling";

  while (leadingFiller.test(t)) {
    t = t.replace(leadingFiller, "").trim();
  }

  return t || raw.trim();
}

export type SuggestNiche =
  | "habits"
  | "fitness"
  | "pets"
  | "food"
  | "finance"
  | "booking"
  | "journal"
  | "generic";

export function detectSuggestNiche(topic: string): SuggestNiche {
  const t = topic.toLowerCase();
  if (/habit|streak|routine|daily check/.test(t)) return "habits";
  if (/workout|fitness|gym|run|exercise/.test(t)) return "fitness";
  if (/dog|pet|walk|paw/.test(t)) return "pets";
  if (/recipe|meal|cook|food|kitchen/.test(t)) return "food";
  if (/budget|money|finance|expense/.test(t)) return "finance";
  if (/book|schedule|appointment/.test(t)) return "booking";
  if (/journal|diary|note/.test(t)) return "journal";
  return "generic";
}
