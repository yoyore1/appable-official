import type { AppCapability } from "@/lib/expo/inferCapabilities";
import { inferAppCapabilities } from "@/lib/expo/inferCapabilities";
import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import { buildInterviewContext } from "./interviewContext";
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
      (m) =>
        m.toLowerCase().includes(d.toLowerCase().slice(0, 12)) ||
        d.toLowerCase().includes(m.toLowerCase().slice(0, 12))
    );
    if (!dupe) merged.push(d);
  }
  while (merged.length < 3) {
    merged.push(defaults[merged.length] ?? "Core workflow");
  }
  return merged.slice(0, 3) as [string, string, string];
}

function wantsRichContent(blob: string, category: AppCategory): boolean {
  if (category === "cooking") return true;
  return /detailed|step.?by.?step|full recipe|ingredient|instruction|in-depth|complete recipe/i.test(
    blob
  );
}

/** Turn master prompt + interview into concrete build requirements. */
export function buildFeaturePlan(
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): FeaturePlan {
  const ctx = buildInterviewContext(mp, interview);
  const category = ctx.category;
  const blob = ctx.transcript;
  const cap = inferAppCapabilities(mp, interview);
  const rich = wantsRichContent(blob, category);
  const instructions: string[] = [
    ...ctx.generationDirectives,
    `The 3 core features MUST appear in UI copy and tabs: ${mp.features.join(" · ")}.`,
  ];

  if (mp.twist) {
    instructions.push(`User's twist (weave into onboarding + home): ${mp.twist}`);
  }

  for (const essential of ctx.essentialFeatures) {
    if (!/save favorite|settings rows/i.test(essential)) {
      instructions.push(`Include essential feature: ${essential}`);
    }
  }

  for (const sig of ctx.signatureFeatures.slice(0, 6)) {
    instructions.push(`Signature UI moment (build visibly): ${sig}`);
  }

  if (ctx.signatureScreens.length > 0) {
    instructions.push(
      `Seed screens/states: ${ctx.signatureScreens.slice(0, 6).join(" · ")}`
    );
  }

  const tabHints: string[] = [];
  instructions.push(
    "IMPLICIT UI (every app, no extra APIs): save/favorite on detail cards, link detail → collection tab where relevant, working profile settings rows."
  );

  if (category === "cooking") {
    tabHints.push("recipes", "lists");
    instructions.push(
      "Cooking: full recipes (ingredients + steps). Lists tab tied to recipes by name.",
      "Detail → Add to shopping list pushes ingredients."
    );
  }
  if (category === "pets") {
    tabHints.push("walks", "messages");
    instructions.push(
      "Pets/dog-walking: Home shows nearby walk requests; Walks tab to browse/apply; Messages for owner ↔ walker chat.",
      "Hero: post walk request (breed, area, budget) or browse walkers — NOT recipes or food scan.",
      "Detail cards: walk details, walker profiles, booking steps — never ingredients."
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
    instructions.push("Wire voice input: mic affordance on home or primary detail screen.");
  }
  if (/read aloud|tts|listen/.test(blob) && category === "cooking") {
    instructions.push("Wire read-aloud: Listen button on recipe detail screens.");
  }

  const explicitCooking =
    category === "cooking" || /recipe|cook\b|meal prep|ingredient/i.test(blob);

  return {
    category,
    contentDepth: rich ? "rich" : "standard",
    requireRecipeDetails: explicitCooking && /recipe|cook|meal|ingredient/i.test(blob),
    requireGroceryLists:
      explicitCooking && /grocery|shop|list|cart|ingredient/.test(blob),
    liveCapabilities: cap.capabilities,
    generationInstructions: instructions,
    tabHints,
  };
}
