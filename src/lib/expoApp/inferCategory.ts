import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";

export type AppCategory =
  | "cooking"
  | "fitness"
  | "social"
  | "productivity"
  | "shopping"
  | "education"
  | "pets"
  | "general";

const SCORE_RULES: { category: AppCategory; pattern: RegExp; weight: number }[] = [
  {
    category: "pets",
    pattern:
      /dog walk|walk your dog|dog walker|pet sit|pet care|rover|wag\b|puppy|paw\b|dogs?\b|pet\b|walker\b|walk request|breed/i,
    weight: 3,
  },
  {
    category: "cooking",
    pattern: /recipe|cook\b|meal prep|kitchen|chef\b|bake\b|ingredient|grocery list/i,
    weight: 2,
  },
  { category: "cooking", pattern: /\bfood\b|\bmeal\b|\bdiet\b/i, weight: 1 },
  { category: "fitness", pattern: /workout|fitness|gym|yoga|exercise|train(?:ing)?/i, weight: 2 },
  { category: "social", pattern: /social feed|friend|community|follow|post photo/i, weight: 2 },
  { category: "social", pattern: /chat|message|dm\b|inbox/i, weight: 1 },
  { category: "productivity", pattern: /task|todo|habit|note|organize|calendar|remind/i, weight: 2 },
  { category: "shopping", pattern: /shop|store|buy|cart|checkout|deal|marketplace/i, weight: 2 },
  { category: "education", pattern: /learn|course|study|lesson|quiz|teach/i, weight: 2 },
];

function interviewBlob(turns: InterviewTurn[]): string {
  return turns.map((t) => `${t.question} ${t.answer}`).join(" ");
}

/** Score every category — highest wins. Interview Q&A outweighs synthesized master prompt. */
export function inferCategory(
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): AppCategory {
  const blob = [
    interviewBlob(interview),
    mp.description,
    mp.audience,
    mp.twist ?? "",
    ...mp.features,
    mp.appName,
  ].join(" ");

  const scores = new Map<AppCategory, number>();
  const bump = (cat: AppCategory, pts: number) =>
    scores.set(cat, (scores.get(cat) ?? 0) + pts);

  for (const { category, pattern, weight } of SCORE_RULES) {
    if (pattern.test(blob)) bump(category, weight);
  }

  // Pet context beats weak "food" hits (dog food, treats, etc.)
  if ((scores.get("pets") ?? 0) >= 2 && (scores.get("cooking") ?? 0) <= 2) {
    scores.delete("cooking");
  }

  let best: AppCategory = "general";
  let bestScore = 0;
  for (const [cat, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return best;
}
