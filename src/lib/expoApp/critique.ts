import { isOnboardingSlogan } from "@/lib/expo/onboardingPack";
import { itemHasContentDetail } from "./genericDetails";
import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import { collectTopologyGaps } from "./enforceProductShape";
import { buildFeaturePlan } from "./featurePlan";
import type { AppCategory } from "./inferCategory";
import type { ExpoAppModel, ExpoAppModelInput } from "./types";

const BANNED =
  /tap to explore|sample item|lorem ipsum|coming soon|placeholder|untitled|feature \d|get started$/i;
const WEAK_ONBOARDING_CTA = /^get started$/i;

export interface CritiqueResult {
  pass: boolean;
  issues: string[];
}

function checkItems(
  items: { title: string; subtitle: string }[],
  ctx: string,
  issues: string[]
) {
  if (items.length < 2) {
    issues.push(`${ctx}: needs at least 2 real list items`);
  }
  const titles = new Set<string>();
  for (const it of items) {
    if (!it.title?.trim() || it.title.length < 4) {
      issues.push(`${ctx}: item title too short or empty`);
    }
    if (BANNED.test(it.title) || BANNED.test(it.subtitle)) {
      issues.push(`${ctx}: banned placeholder copy — "${it.title}"`);
    }
    if (titles.has(it.title)) {
      issues.push(`${ctx}: duplicate item title "${it.title}"`);
    }
    titles.add(it.title);
  }
}

export function critiqueExpoApp(
  input: ExpoAppModel | ExpoAppModelInput,
  interview: InterviewTurn[] = [],
  mp?: { description: string; audience: string; features: string[]; appName: string; twist?: string | null }
): CritiqueResult {
  const issues: string[] = [];

  if (!input.onboarding || input.onboarding.length < 2) {
    issues.push("Onboarding needs at least 2 slides with real value props");
  }
  for (const slide of input.onboarding ?? []) {
    if (BANNED.test(slide.title) || BANNED.test(slide.subtitle)) {
      issues.push(`Onboarding slide has placeholder copy: "${slide.title}"`);
    }
    if (isOnboardingSlogan(slide.title, slide.subtitle)) {
      issues.push(
        `Onboarding "${slide.title}" is a slogan — must DEMONSTRATE a real feature (field: demonstrates)`
      );
    }
    if (!slide.demonstrates?.trim()) {
      issues.push(`Onboarding slide "${slide.title}" missing demonstrates (which feature it shows)`);
    }
    if ((slide.subtitle?.length ?? 0) < 28) {
      issues.push(`Onboarding slide "${slide.title}" subtitle too thin — show the feature in action`);
    }
    if (slide.ctaLabel && WEAK_ONBOARDING_CTA.test(slide.ctaLabel.trim())) {
      issues.push(`Onboarding CTA should be forward motion (e.g. "Let's cook"), not "Get started"`);
    }
  }

  if (!input.tabs?.length || input.tabs.length < 3) {
    issues.push("Need at least 3 tabs with icons");
  }

  if (!input.home?.sections?.length) {
    issues.push("Home needs content sections with real items");
  }
  for (const sec of input.home?.sections ?? []) {
    checkItems(sec.items, `Home section "${sec.title}"`, issues);
  }

  for (const [tabId, screen] of Object.entries(input.tabScreens ?? {})) {
    checkItems(screen.items, `Tab "${tabId}"`, issues);
  }

  if (!input.profile?.settings?.length) {
    issues.push("Profile needs settings rows");
  } else {
    const labels = input.profile.settings.map((s) => s.label);
    if (!labels.some((l) => /sign[\s-]?out|log[\s-]?out/i.test(l))) {
      issues.push("Profile settings need Sign out");
    }
    if (!labels.some((l) => /delete\s+(my\s+)?account|remove\s+account/i.test(l))) {
      issues.push("Profile settings need Delete account");
    }
  }

  const planCategory =
    mp != null
      ? buildFeaturePlan(
          {
            appName: mp.appName,
            description: mp.description,
            audience: mp.audience,
            twist: mp.twist ?? null,
            features: mp.features,
            layoutArchetype: "",
            vibe: "Minimal",
            colors: "",
            screens: [],
            referenceApp: null,
          },
          interview
        ).category
      : ((input.category ?? "general") as AppCategory);

  if (planCategory === "cooking") {
    const hasRecipesTab = Object.keys(input.tabScreens ?? {}).some((id) =>
      /recipe/i.test(id)
    );
    if (!hasRecipesTab) {
      issues.push('Cooking app needs a "recipes" tab with full recipe content');
    }
  }

  const category = (input.category ?? planCategory) as AppCategory;

  if (planCategory === "pets") {
    const hasCookingLeak = Object.keys(input.tabScreens ?? {}).some((id) =>
      /recipe/i.test(id)
    );
    if (hasCookingLeak) {
      issues.push('Pet app must NOT have a "recipes" tab — use walks/messages instead');
    }
    for (const it of input.home?.sections?.flatMap((s) => s.items) ?? []) {
      if (it.detailType === "recipe" || (it.ingredients?.length ?? 0) > 0) {
        issues.push(`"${it.title}" has recipe content — use walk/booking detail instead`);
      }
    }
  }
  const collectionTab = input.tabs?.find((t) =>
    /list|grocery|cart|plan|library|shop|task/i.test(`${t.id} ${t.label}`)
  )?.id;

  for (const sec of input.home?.sections ?? []) {
    for (const it of sec.items) {
      if (!itemHasContentDetail(it, category)) {
        issues.push(
          `Home "${sec.title}": "${it.title}" needs full detail (body + steps)`
        );
      }
    }
  }
  for (const [tabId, screen] of Object.entries(input.tabScreens ?? {})) {
    if (tabId === collectionTab) continue;
    for (const it of screen.items) {
      if (!itemHasContentDetail(it, category)) {
        issues.push(`Tab "${tabId}": "${it.title}" needs full detail (body + steps)`);
      }
    }
  }

  if (mp) {
    const fullMp = mp as MasterBuildPrompt;
    issues.push(...collectTopologyGaps(input, fullMp, interview));
  }

  return { pass: issues.length === 0, issues };
}
