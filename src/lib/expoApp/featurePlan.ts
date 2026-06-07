import type { AppCapability } from "@/lib/expo/inferCapabilities";
import { inferAppCapabilities } from "@/lib/expo/inferCapabilities";
import type { MasterBuildPrompt } from "@/lib/types";
import { inferCategory, type AppCategory } from "./inferCategory";

export interface FeaturePlan {
  category: AppCategory;
  contentDepth: "rich" | "standard";
  requireRecipeDetails: boolean;
  requireGroceryLists: boolean;
  liveCapabilities: AppCapability[];
  generationInstructions: string[];
  tabHints: string[];
}

/** Split free-text features / twist into distinct feature phrases. */
export function parseUserFeatures(raw: string): string[] {
  return raw
    .split(/[,\n;]|(?:\band\b)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

/** Prefer what the user said; fill gaps from archetype defaults. */
export function mergeFeatureList(
  user: string[],
  defaults: string[]
): [string, string, string] {
  const merged = [...user];
  for (const d of defaults) {
    if (merged.length >= 3) break;
    const dupe = merged.some(
      (m) => m.toLowerCase().includes(d.toLowerCase().slice(0, 12)) ||
        d.toLowerCase().includes(m.toLowerCase().slice(0, 12))
    );
    if (!dupe) merged.push(d);
  }
  while (merged.length < 3) {
    merged.push(defaults[merged.length] ?? "Core workflow");
  }
  return merged.slice(0, 3) as [string, string, string];
}

function wantsRichContent(blob: string): boolean {
  return /detailed|step.?by.?step|full recipe|ingredient|instruction|in-depth|complete recipe/i.test(
    blob
  );
}

/** Turn master prompt into concrete build requirements for codegen + preview. */
export function buildFeaturePlan(mp: MasterBuildPrompt): FeaturePlan {
  const category = inferCategory(mp);
  const blob = [
    mp.description,
    mp.audience,
    mp.twist ?? "",
    ...mp.features,
    mp.appName,
  ].join(" ");
  const cap = inferAppCapabilities(mp);
  const rich = wantsRichContent(blob) || category === "cooking";
  const instructions: string[] = [
    `App name: ${mp.appName}. Audience: ${mp.audience}.`,
    `The 3 core features MUST appear in UI copy and tabs: ${mp.features.join(" · ")}.`,
    `Description to honor: ${mp.description}`,
  ];

  if (mp.twist) {
    instructions.push(`User's twist (weave into onboarding + home): ${mp.twist}`);
  }

  const tabHints: string[] = [];
  instructions.push(
    "IMPLICIT UI (every app, no extra APIs): save/favorite on detail cards, link detail → list/collection tab where relevant, working profile settings rows."
  );

  if (category === "cooking" || /recipe|meal|food|cook/.test(blob)) {
    tabHints.push("recipes", "lists");
    instructions.push(
      "Cooking: full recipes (ingredients + steps). Lists tab tied to recipes by name.",
      "Detail → Add to shopping list pushes ingredients."
    );
  }
  if (category === "fitness" || /workout|gym|train/.test(blob)) {
    tabHints.push("workouts", "plan");
    instructions.push("Fitness: workouts open full detail; Add to plan sends to plan/list tab.");
  }
  if (category === "productivity" || /task|todo|habit|note/.test(blob)) {
    tabHints.push("tasks", "lists");
    instructions.push("Productivity: items checkable on list tab; save favorites in profile.");
  }
  if (category === "shopping" || /shop|cart|store/.test(blob)) {
    tabHints.push("shop", "cart");
    instructions.push("Shopping: product detail → Add to cart/list.");
  }
  if (category === "education" || /learn|course|lesson/.test(blob)) {
    tabHints.push("library", "discover");
    instructions.push("Education: lessons open full detail; Save to library on cards.");
  }
  if (category === "social" || /feed|post|friend/.test(blob)) {
    instructions.push("Social: save posts; profile settings fully labeled.");
  }
  if (/voice|dictat|speak|audio/.test(blob)) {
    instructions.push("Wire voice input: mic affordance on home or recipe detail.");
  }
  if (/read aloud|tts|listen|audio recipe/.test(blob)) {
    instructions.push("Wire read-aloud: Listen button on every recipe detail.");
  }

  return {
    category,
    contentDepth: rich ? "rich" : "standard",
    requireRecipeDetails: category === "cooking" || /recipe|detailed|step/i.test(blob),
    requireGroceryLists: /grocery|shop|list|cart|ingredient/.test(blob),
    liveCapabilities: cap.capabilities,
    generationInstructions: instructions,
    tabHints,
  };
}
