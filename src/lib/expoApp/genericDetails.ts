import type { AppCategory } from "./inferCategory";
import { itemHasRecipeDetail } from "./recipeDetails";
import type { ExpoListItem } from "./types";

/** Same bar as recipes — every detail card needs body + steps (or ingredients for cooking). */
export function itemHasContentDetail(
  item: ExpoListItem,
  category: AppCategory
): boolean {
  if (
    category === "cooking" ||
    item.detailType === "recipe" ||
    (item.ingredients?.length ?? 0) > 0
  ) {
    return itemHasRecipeDetail(item);
  }
  const hasBody = (item.body?.length ?? 0) > 18;
  const hasSteps = (item.steps?.length ?? 0) >= 3;
  return hasBody && hasSteps;
}

const WORKOUT_BODIES = [
  "Full-body burner — no equipment. Perfect for a tight lunch break.",
  "Low-impact strength circuit. Great for building consistency.",
  "HIIT finisher — gets your heart rate up in 20 minutes.",
];

const WORKOUT_STEPS = [
  ["Warm up 3 min: march in place, arm circles", "Squats × 12", "Push-ups × 10 (knees ok)", "Plank 30 sec", "Rest 60 sec — repeat 3 rounds", "Cool down stretch"],
  ["5 min brisk walk", "Lunges × 10 each leg", "Glute bridges × 15", "Dead bug × 12", "Repeat circuit twice", "Hydrate + log it"],
];

const LESSON_BODIES = [
  "A practical lesson with clear takeaways you can apply today.",
  "Step-by-step walkthrough with examples.",
];

const LESSON_STEPS = [
  ["Watch the intro (2 min)", "Read the key concept", "Try the practice exercise", "Check your understanding", "Save notes to library"],
  ["Skim the outline", "Complete section 1", "Quiz yourself", "Review missed items", "Mark complete"],
];

const PRODUCT_BODIES = [
  "Highly rated pick for everyday use. Ships fast.",
  "Bestseller in this category — great value.",
];

export function attachGenericDetail(
  item: ExpoListItem,
  category: AppCategory,
  index: number
): ExpoListItem {
  if (item.body && item.steps && item.steps.length >= 3) return item;

  if (category === "fitness" || /workout|train|exercise/i.test(item.title + item.subtitle)) {
    const bi = index % WORKOUT_BODIES.length;
    return {
      ...item,
      detailType: "article",
      body: item.body ?? WORKOUT_BODIES[bi],
      steps: item.steps?.length ? item.steps : WORKOUT_STEPS[bi % WORKOUT_STEPS.length],
    };
  }

  if (category === "education" || /lesson|course|learn|module/i.test(item.title + item.subtitle)) {
    const bi = index % LESSON_BODIES.length;
    return {
      ...item,
      detailType: "article",
      body: item.body ?? LESSON_BODIES[bi],
      steps: item.steps?.length ? item.steps : LESSON_STEPS[bi % LESSON_STEPS.length],
    };
  }

  if (category === "shopping" || /product|deal|item/i.test(item.subtitle)) {
    return {
      ...item,
      detailType: "generic",
      body: item.body ?? PRODUCT_BODIES[index % PRODUCT_BODIES.length],
      steps: item.steps ?? ["View details", "Add to cart", "Checkout when ready"],
    };
  }

  if (category === "productivity") {
    return {
      ...item,
      detailType: "list",
      body: item.body ?? `Task for ${item.title}. Check off when done.`,
      steps: item.steps ?? ["Open task", "Complete sub-steps", "Mark done", "Review in library"],
    };
  }

  if (category === "social") {
    return {
      ...item,
      detailType: "article",
      body: item.body ?? `${item.title} — shared by someone in your circle.`,
      steps: item.steps ?? ["View post", "Like or reply", "Save to collection", "Share"],
    };
  }

  if (!item.body) {
    return {
      ...item,
      body: item.subtitle || `Details for ${item.title}.`,
      detailType: item.detailType ?? "generic",
    };
  }

  return item;
}
