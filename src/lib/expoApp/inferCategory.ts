import type { MasterBuildPrompt } from "@/lib/types";

export type AppCategory =
  | "cooking"
  | "fitness"
  | "social"
  | "productivity"
  | "shopping"
  | "education"
  | "pets"
  | "general";

const RULES: { category: AppCategory; pattern: RegExp }[] = [
  { category: "pets", pattern: /dog|pet|puppy|paw|walker|walk your|dog walk|sitter/i },
  { category: "cooking", pattern: /cook|recipe|meal|food|kitchen|grocery|diet|chef|bake/i },
  { category: "fitness", pattern: /workout|fitness|gym|run|health|yoga|train/i },
  { category: "social", pattern: /chat|friend|social|community|message|share/i },
  { category: "productivity", pattern: /task|todo|habit|note|plan|organize|calendar/i },
  { category: "shopping", pattern: /shop|store|buy|cart|deal|market/i },
  { category: "education", pattern: /learn|course|study|lesson|quiz|teach/i },
];

export function inferCategory(mp: MasterBuildPrompt): AppCategory {
  const blob = [
    mp.description,
    mp.audience,
    ...mp.features,
    mp.appName,
  ].join(" ");
  for (const { category, pattern } of RULES) {
    if (pattern.test(blob)) return category;
  }
  return "general";
}
