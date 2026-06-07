import { inferAppCapabilities } from "@/lib/expo/inferCapabilities";
import { buildFeaturePlan } from "./featurePlan";
import { attachGenericDetail, itemHasContentDetail } from "./genericDetails";
import { imageForCategory, onboardingImage } from "./images";
import { attachRecipeDetail, itemHasRecipeDetail } from "./recipeDetails";
import { enrichOnboardingSlides } from "./enrichOnboarding";
import {
  defaultProfileStats,
  defaultSettingsRows,
  ensureLegalSettingsRows,
} from "./smartInteractions";
import { buildAppBlueprint } from "./smartBlueprint";
import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import { collectActionPlanGaps } from "./actionPlanSeed";
import { enforceProductShape } from "./enforceProductShape";
import { flowFromSpec, inferProductSpec } from "./productSpec";
import { collectTopologyGaps } from "./enforceProductShape";
import type { ExpoAppModelInput, ExpoListItem } from "./types";

function safeUrl(url: string | undefined, index: number, category: string): string {
  if (url && /^https:\/\//i.test(url)) return url;
  return imageForCategory(category, index);
}

function normalizeImages(input: ExpoAppModelInput, category: string): ExpoAppModelInput {
  let idx = 0;
  const mapItem = (it: ExpoListItem) => ({
    ...it,
    imageUrl: safeUrl(it.imageUrl, idx++, category),
  });
  return {
    ...input,
    onboarding: input.onboarding.map((s, i) => ({
      ...s,
      imageUrl: safeUrl(s.imageUrl, i, category) || onboardingImage(i, category),
    })),
    home: {
      ...input.home,
      sections: input.home.sections.map((sec) => ({
        ...sec,
        items: sec.items.map(mapItem),
      })),
    },
    tabScreens: Object.fromEntries(
      Object.entries(input.tabScreens).map(([k, screen]) => [
        k,
        { ...screen, items: screen.items.map(mapItem) },
      ])
    ),
  };
}

function collectContentTitles(input: ExpoAppModelInput): string[] {
  const titles: string[] = [];
  for (const sec of input.home.sections) {
    for (const it of sec.items) titles.push(it.title);
  }
  for (const [tabId, screen] of Object.entries(input.tabScreens)) {
    if (/recipe|workout|discover|shop|task|lesson|walk|message/i.test(`${tabId} ${screen.title}`)) {
      for (const it of screen.items) titles.push(it.title);
    }
  }
  return [...new Set(titles.filter(Boolean))];
}

function linkCollectionItems(
  items: ExpoListItem[],
  contentTitles: string[],
  collectionLabel: string
): ExpoListItem[] {
  if (!contentTitles.length) return items;
  return items.map((item, i) => {
    const linked = contentTitles[i % contentTitles.length];
    const already = [item.subtitle, item.body, item.title].join(" ").includes(linked);
    if (already) return item;
    return {
      ...item,
      detailType: item.detailType ?? "list",
      subtitle:
        item.subtitle && item.subtitle.length > 12
          ? `${item.subtitle} · linked to ${linked}`
          : `For ${linked}`,
      body:
        item.body ??
        `${collectionLabel} for ${linked}. Check off items as you go — share in one tap.`,
    };
  });
}

function personalizeCopy(
  input: ExpoAppModelInput,
  mp: MasterBuildPrompt,
  blueprint: ReturnType<typeof buildAppBlueprint>
): ExpoAppModelInput {
  const aud =
    mp.audience.split(/[,;]/)[0]?.trim().toLowerCase() ?? mp.audience.toLowerCase();
  const sub = input.home.subheadline ?? "";
  const needsAudience = aud.length > 3 && !sub.toLowerCase().includes(aud.slice(0, 10));

  const onboarding = enrichOnboardingSlides(
    input.onboarding.length >= 3
      ? input.onboarding
      : blueprint.onboardingAngles.map((subtitle, i) => ({
          title: input.onboarding[i]?.title ?? blueprint.appName,
          subtitle: input.onboarding[i]?.subtitle ?? subtitle,
          imageUrl: input.onboarding[i]?.imageUrl ?? onboardingImage(i),
        })),
    mp,
    blueprint
  );

  return {
    ...input,
    onboarding,
    home: {
      ...input.home,
      headline: input.home.headline || `Welcome to ${mp.appName}`,
      subheadline: needsAudience
        ? `${sub || mp.description} — built for ${mp.audience}.`
        : sub || mp.description,
      heroLabel: input.home.heroLabel || blueprint.hero.label,
      heroSublabel: input.home.heroSublabel || blueprint.hero.sublabel,
    },
    profile: {
      ...input.profile,
      displayName: input.profile.displayName || mp.appName,
      tagline: input.profile.tagline || `${mp.vibe} · ${mp.audience}`,
      stats:
        input.profile.stats?.length >= 3
          ? input.profile.stats
          : defaultProfileStats(blueprint.category),
      settings: ensureLegalSettingsRows(
        input.profile.settings?.length >= 4
          ? input.profile.settings
          : defaultSettingsRows(blueprint.category)
      ),
    },
  };
}

function isCollectionTab(
  tabId: string,
  screenTitle: string,
  collectionTabId: string | null
): boolean {
  return (
    tabId === collectionTabId ||
    /list|grocery|cart|plan|library|shop|task|wish|check/i.test(`${tabId} ${screenTitle}`)
  );
}

/** Cooking → recipeDetails. Every other category → genericDetails. Same pipeline. */
function attachContentDetail(
  item: ExpoListItem,
  category: ReturnType<typeof buildFeaturePlan>["category"],
  index: number,
  asRecipe: boolean
): ExpoListItem {
  if (asRecipe) return attachRecipeDetail(item, index);
  return attachGenericDetail(item, category, index);
}

/**
 * Smart general layer — runs on EVERY app type after generate/seed.
 * Fills detail bodies, cross-links collection tabs, personalizes copy. Zero LLM tokens.
 */
export function enrichExpoContent(
  input: ExpoAppModelInput,
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): ExpoAppModelInput {
  const plan = buildFeaturePlan(mp, interview);
  const blueprint = buildAppBlueprint(mp, interview);
  const cap = inferAppCapabilities(mp, interview);
  const category = plan.category;

  let next = normalizeImages(input, category);
  next = personalizeCopy(next, mp, blueprint);

  const contentTitles = collectContentTitles(next);
  const collectionTabId = blueprint.collectionTabId;
  let detailIdx = 0;

  const homeSections = next.home.sections.map((sec) => {
    const isRecipeSection =
      plan.requireRecipeDetails &&
      /recipe|tonight|pick|scan|cook|meal|dish/i.test(sec.title);
    return {
      ...sec,
      items: sec.items.map((item, i) =>
        attachContentDetail(item, category, detailIdx + i, isRecipeSection)
      ),
    };
  });
  detailIdx += homeSections.reduce((n, s) => n + s.items.length, 0);

  const tabScreens: ExpoAppModelInput["tabScreens"] = {};
  for (const [tabId, screen] of Object.entries(next.tabScreens)) {
    const isRecipesTab =
      plan.requireRecipeDetails &&
      /recipe/i.test(`${tabId} ${screen.title}`);
    const isCollection = isCollectionTab(tabId, screen.title, collectionTabId);

    tabScreens[tabId] = {
      ...screen,
      items: (isCollection
        ? linkCollectionItems(screen.items, contentTitles, blueprint.collectionActionLabel)
        : screen.items
      ).map((item, i) =>
        attachContentDetail(item, category, detailIdx + i, isRecipesTab)
      ),
    };
    if (!isCollection) detailIdx += screen.items.length;
  }

  const spec = inferProductSpec(mp, interview);
  const flow = next.flow?.roles?.length ? next.flow : flowFromSpec(spec);

  const enriched: ExpoAppModelInput = {
    ...next,
    flow: flow ?? next.flow,
    category: plan.category === "cooking" ? "cooking" : plan.category,
    home: {
      ...next.home,
      heroLabel: cap.capabilities.includes("vision_ai")
        ? next.home.heroLabel || blueprint.hero.label
        : next.home.heroLabel || blueprint.hero.label,
      heroSublabel: cap.capabilities.includes("vision_ai")
        ? next.home.heroSublabel || blueprint.hero.sublabel
        : next.home.heroSublabel || blueprint.hero.sublabel,
      sections: homeSections,
    },
    tabScreens,
  };

  return enforceProductShape(enriched, mp, interview);
}

export function countRecipeGaps(input: ExpoAppModelInput): number {
  let gaps = 0;
  for (const sec of input.home.sections) {
    if (/recipe|tonight|pick|scan|cook/i.test(sec.title)) {
      for (const it of sec.items) if (!itemHasRecipeDetail(it)) gaps++;
    }
  }
  for (const [tabId, screen] of Object.entries(input.tabScreens)) {
    if (/recipe/i.test(tabId) || /recipe/i.test(screen.title)) {
      for (const it of screen.items) if (!itemHasRecipeDetail(it)) gaps++;
    }
  }
  return gaps;
}

function collectDetailGaps(
  items: ExpoListItem[],
  ctx: string,
  category: ReturnType<typeof buildFeaturePlan>["category"],
  issues: string[]
) {
  for (const it of items) {
    if (!itemHasContentDetail(it, category)) {
      const need =
        category === "cooking"
          ? "ingredients[] (6+) and steps[] (5+)"
          : "body and steps[] (3+)";
      issues.push(`"${it.title}" in ${ctx} missing ${need}.`);
    }
  }
}

/** Remaining content gaps after enrich — any app type, fed into one refine pass. */
export function collectEnrichGaps(
  input: ExpoAppModelInput,
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): string[] {
  const plan = buildFeaturePlan(mp, interview);
  const blueprint = buildAppBlueprint(mp, interview);
  const issues: string[] = [];

  for (const sec of input.home.sections) {
    collectDetailGaps(sec.items, `Home "${sec.title}"`, plan.category, issues);
  }
  for (const [tabId, screen] of Object.entries(input.tabScreens)) {
    if (isCollectionTab(tabId, screen.title, blueprint.collectionTabId)) continue;
    collectDetailGaps(screen.items, `Tab "${tabId}"`, plan.category, issues);
  }
  issues.push(...collectTopologyGaps(input, mp, interview));
  issues.push(...collectActionPlanGaps(input, mp));
  return issues;
}
