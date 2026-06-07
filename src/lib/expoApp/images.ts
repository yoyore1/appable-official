/** Curated Unsplash crops — category-appropriate, not random food for every app. */
const FOOD = [
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=480&h=320&fit=crop&q=80",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=480&h=320&fit=crop&q=80",
  "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=480&h=320&fit=crop&q=80",
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=480&h=320&fit=crop&q=80",
];

const PETS = [
  "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=480&h=320&fit=crop&q=80",
  "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=480&h=320&fit=crop&q=80",
  "https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=480&h=320&fit=crop&q=80",
  "https://images.unsplash.com/photo-1558788353-f76d92427f16?w=480&h=320&fit=crop&q=80",
  "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=480&h=320&fit=crop&q=80",
];

const LIFESTYLE = [
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=480&h=320&fit=crop&q=80",
  "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=480&h=320&fit=crop&q=80",
  "https://images.unsplash.com/photo-1551434678-e076c223a692?w=480&h=320&fit=crop&q=80",
];

const FITNESS = [
  "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=480&h=320&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=480&h=320&fit=crop&q=80",
];

export function foodImage(i: number): string {
  return FOOD[i % FOOD.length];
}

export function petImage(i: number): string {
  return PETS[i % PETS.length];
}

export function lifestyleImage(i: number): string {
  return LIFESTYLE[i % LIFESTYLE.length];
}

export function onboardingImage(i: number, category = "general"): string {
  return imageForCategory(category, i + 3);
}

export function imageForCategory(category: string, index: number): string {
  if (category === "pets") return petImage(index);
  if (category === "food" || category === "cooking") return foodImage(index);
  if (category === "fitness") return FITNESS[index % FITNESS.length];
  return lifestyleImage(index);
}
