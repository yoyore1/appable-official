import type { ExpoListItem } from "./types";

export interface RecipeDetail {
  body: string;
  ingredients: string[];
  steps: string[];
}

/** Premium fallback recipes — used when LLM output lacks full detail. */
export const RECIPE_TEMPLATES: RecipeDetail[] = [
  {
    body: "Bright, weeknight-friendly chicken with crisp edges and a lemon-garlic pan sauce.",
    ingredients: [
      "4 bone-in chicken thighs",
      "2 tbsp olive oil",
      "3 cloves garlic, sliced",
      "1 lemon (zest + juice)",
      "1 tsp dried oregano",
      "½ tsp smoked paprika",
      "Salt & black pepper",
      "2 tbsp butter",
      "Fresh parsley",
    ],
    steps: [
      "Pat chicken dry; season with salt, pepper, paprika, and oregano.",
      "Heat olive oil in a large skillet over medium-high. Sear chicken skin-side down 6–7 min until golden.",
      "Flip; cook 5 min more. Lower heat to medium.",
      "Add garlic; cook 30 sec until fragrant.",
      "Pour in lemon juice and ¼ cup water. Scatter lemon zest. Simmer 4 min.",
      "Swirl in butter. Spoon sauce over chicken. Rest 3 min, garnish parsley, serve.",
    ],
  },
  {
    body: "Creamy sundried-tomato pasta that feels restaurant-level but ready in one pot.",
    ingredients: [
      "12 oz penne",
      "1 cup heavy cream",
      "½ cup grated parmesan",
      "⅓ cup sundried tomatoes, chopped",
      "3 cups baby spinach",
      "2 tbsp olive oil",
      "3 garlic cloves, minced",
      "1 tsp Italian seasoning",
      "Salt & chili flakes",
    ],
    steps: [
      "Boil penne in salted water until al dente; reserve 1 cup pasta water.",
      "Warm olive oil; sauté garlic 45 sec.",
      "Add cream, sundried tomatoes, Italian seasoning. Simmer 3 min.",
      "Stir in parmesan until silky; loosen with pasta water if needed.",
      "Fold in spinach until wilted; toss pasta. Season and serve immediately.",
    ],
  },
  {
    body: "Sheet-pan fajita bowls with charred peppers and lime-cilantro rice.",
    ingredients: [
      "1 lb chicken breast, sliced",
      "2 bell peppers, strips",
      "1 red onion, wedges",
      "2 tbsp fajita seasoning",
      "2 cups cooked rice",
      "1 lime (juice)",
      "¼ cup cilantro",
      "Black beans, avocado, salsa (optional)",
    ],
    steps: [
      "Heat oven to 425°F. Toss chicken, peppers, onion with oil and fajita seasoning.",
      "Spread on a sheet pan; roast 18–20 min, flipping once.",
      "Mix rice with lime juice and cilantro.",
      "Divide rice into bowls; top with roasted fajita mix.",
      "Add beans, avocado, salsa as desired. Finish with extra lime.",
    ],
  },
  {
    body: "Tomato basil risotto — stir patiently for a silky, comforting bowl.",
    ingredients: [
      "1½ cups arborio rice",
      "4 cups warm chicken broth",
      "1 cup cherry tomatoes, halved",
      "½ cup white wine",
      "1 shallot, minced",
      "3 tbsp butter",
      "½ cup parmesan",
      "Fresh basil",
      "Salt & pepper",
    ],
    steps: [
      "Sauté shallot in 1 tbsp butter until soft.",
      "Toast rice 2 min. Deglaze with wine; stir until absorbed.",
      "Add broth one ladle at a time, stirring until each is absorbed.",
      "After ~18 min, fold in tomatoes, remaining butter, parmesan.",
      "Adjust salt; rest 2 min. Top with basil and serve.",
    ],
  },
  {
    body: "Fast garlic butter shrimp — perfect over pasta or crusty bread.",
    ingredients: [
      "1 lb large shrimp, peeled",
      "4 tbsp butter",
      "4 garlic cloves, minced",
      "¼ tsp red pepper flakes",
      "Juice of ½ lemon",
      "2 tbsp parsley",
      "Salt & pepper",
    ],
    steps: [
      "Pat shrimp dry; season with salt and pepper.",
      "Melt butter in a skillet over medium-high.",
      "Add garlic and pepper flakes; cook 30 sec.",
      "Add shrimp in one layer; cook 2 min per side until pink.",
      "Splash lemon juice; toss with parsley. Serve immediately.",
    ],
  },
  {
    body: "Mediterranean grain bowl with lemon-tahini drizzle — great for meal prep.",
    ingredients: [
      "1 cup cooked quinoa",
      "1 cup chickpeas, roasted",
      "1 cucumber, diced",
      "1 cup cherry tomatoes",
      "¼ red onion, sliced",
      "2 tbsp tahini",
      "1 lemon",
      "2 tbsp olive oil",
      "Feta & mint",
    ],
    steps: [
      "Whisk tahini, lemon juice, olive oil, and 2 tbsp water into a dressing.",
      "Divide quinoa among bowls.",
      "Top with chickpeas, cucumber, tomatoes, onion.",
      "Drizzle dressing; crumble feta and mint. Serve chilled or room temp.",
    ],
  },
];

export function recipeListenText(item: ExpoListItem): string {
  const parts = [item.title];
  if (item.body) parts.push(item.body);
  if (item.ingredients?.length) {
    parts.push("Ingredients. " + item.ingredients.join(". "));
  }
  if (item.steps?.length) {
    parts.push("Steps. " + item.steps.map((s, i) => `Step ${i + 1}. ${s}`).join(" "));
  }
  if (parts.length === 1) parts.push(item.subtitle);
  return parts.join(". ").slice(0, 1200);
}

export function attachRecipeDetail(
  item: ExpoListItem,
  templateIndex: number
): ExpoListItem {
  if (item.detailType === "recipe" && item.steps && item.steps.length >= 4) {
    return item;
  }
  const t = RECIPE_TEMPLATES[templateIndex % RECIPE_TEMPLATES.length];
  return {
    ...item,
    detailType: "recipe",
    body: item.body ?? t.body,
    ingredients: item.ingredients?.length ? item.ingredients : t.ingredients,
    steps: item.steps?.length ? item.steps : t.steps,
  };
}

export function itemHasRecipeDetail(item: ExpoListItem): boolean {
  return Boolean(
    item.detailType === "recipe" &&
      item.ingredients &&
      item.ingredients.length >= 4 &&
      item.steps &&
      item.steps.length >= 4
  );
}
