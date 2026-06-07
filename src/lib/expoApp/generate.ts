import { integrations, planModel } from "@/lib/config";
import { deviceFeaturesFor } from "@/lib/expo/deviceFeatures";
import { inferAppCapabilities } from "@/lib/expo/inferCapabilities";
import { setBuildProgress } from "@/lib/buildProgressStore";
import {
  ONBOARDING_PSYCHOLOGY_RULES,
  PREMIUM_POLISH_RULES,
  onboardingContextFor,
  psychologyHintsFor,
} from "@/lib/expo/onboardingPsychology";
import type { MasterBuildPrompt } from "@/lib/types";
import { collectEnrichGaps, enrichExpoContent } from "./enrichContent";
import { buildAppBlueprint } from "./smartBlueprint";
import { buildFeaturePlan } from "./featurePlan";
import { buildPreviewUiConfig } from "./previewFeatures";
import { critiqueExpoApp } from "./critique";
import { generateExpoImages } from "./generateExpoImages";
import { inferCategory } from "./inferCategory";
import { seedExpoAppContent } from "./seedContent";
import { buildTheme } from "./theme";
import type { ExpoAppModel, ExpoAppModelInput } from "./types";

function parseJsonFromText<T>(text: string): T | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim()) as T;
      } catch {
        /* */
      }
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T;
      } catch {
        /* */
      }
    }
  }
  return null;
}

async function runWithBuildHeartbeat<T>(
  projectId: string | undefined,
  ctx: {
    stepId: string;
    label: string;
    index: number;
    total: number;
    percent: number;
    cap: number;
  },
  work: () => Promise<T>
): Promise<T> {
  if (!projectId) return work();

  let pct = ctx.percent;
  const interval = setInterval(() => {
    pct = Math.min(ctx.cap, pct + 1);
    setBuildProgress(projectId, {
      stepId: ctx.stepId,
      label: ctx.label,
      index: ctx.index,
      total: ctx.total,
      percent: pct,
    });
  }, 3200);

  try {
    return await work();
  } finally {
    clearInterval(interval);
  }
}

async function callPlanModel(
  system: string,
  user: string,
  json = true
): Promise<string> {
  if (!integrations.planModel || !planModel.baseUrl || !planModel.key) return "";
  const url = `${planModel.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${planModel.key}`,
    },
    body: JSON.stringify({
      model: planModel.name,
      temperature: 0.35,
      max_tokens: 8000,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) return "";
  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? "").trim();
}

const GENERATE_SYSTEM = `You are an expert React Native product designer. Output STRICT JSON for an ExpoAppModel (no markdown).

QUALITY BAR (mandatory):
- NO placeholder text: never "Tap to explore", "Sample item", "Lorem", "Coming soon", empty cards.
- IMPLEMENT every feature the user asked for in tabs, hero actions, and real content — not just labels.
- REAL domain content for THIS specific app — full recipes with ingredients & steps, real list names, stats, settings.
- Onboarding: exactly 3 slides — each DEMONSTRATES a real feature (demonstrates, ctaLabel, kind fields). NO slogans.
- tabs: 4 tabs with id, label, icon (lucide names: home, chef-hat, utensils, shopping-cart, list, user, camera, heart, book-open, search, settings, bell, shield, help-circle).
- home: headline, subheadline, heroLabel, heroSublabel, sections[] each with title + items[].
- tabScreens: object keyed by tab id (not home/profile) with title, subtitle, items[] (4+ unique items per screen).
- profile: displayName, tagline, stats[3], settings[4+].

ONBOARDING SLIDE SCHEMA (every onboarding[] entry):
{
  "title", "subtitle", "imageUrl" (unsplash lifestyle/food),
  "demonstrates": "which feature this slide shows in action",
  "ctaLabel": "forward motion CTA e.g. Let's cook / Start training",
  "kind": "feature_demo" | "personalization" | "value_prop" | "completion"
}

LIST ITEM SCHEMA (every items[] entry):
{
  "id", "title", "subtitle", "meta", "badge" (optional),
  "imageUrl" (unsplash food/lifestyle URL),
  "detailType": "recipe" | "list" | "article" | "generic",
  "body": "1-2 sentence intro",
  "ingredients": ["quantity + ingredient", ...]  // REQUIRED for recipes, 6+ items
  "steps": ["step 1...", "step 2...", ...]       // REQUIRED for recipes, 5+ steps
}

IMPLICIT UI (every app type — no extra APIs):
- save_favorite on every detail card (heart/save button)
- add_to_collection when a list/cart/plan/library tab exists — link detail content to that tab
- profile settings rows must use real labels; preview treats them as tappable

ALL APP TYPES (use blueprint.tabs + blueprint.featureWiring):
- Follow blueprint.category and tab ids from context.blueprint
- EVERY list item: body + steps[] (3+). Cooking/recipes also need ingredients[] (6+).
- Collection tab (lists/cart/plan/library) items must reference content titles from other tabs
- Fitness: workouts tab with step-by-step sessions; plan tab for scheduled items
- Productivity: tasks tab with checkable items; library for saved
- Shopping: shop tab with products; cart tab linked by product name
- Education: discover + library; lessons with learning steps
- Social/general: posts or items with body + interaction steps

COOKING / RECIPE APPS (category "cooking"):
- MUST include "recipes" tab with 5+ full recipes (ingredients + steps on every item)
- lists tab with grocery items tied to recipe names
- heroLabel/sublabel match photo→recipe when camera/scan mentioned

${ONBOARDING_PSYCHOLOGY_RULES}

${PREMIUM_POLISH_RULES}`;

function buildGenerationContext(mp: MasterBuildPrompt) {
  const devices = deviceFeaturesFor(mp);
  const plan = buildFeaturePlan(mp);
  const cap = inferAppCapabilities(mp);
  const blueprint = buildAppBlueprint(mp);
  return {
    masterPrompt: mp,
    layoutArchetype: mp.layoutArchetype,
    devicePackages: devices.packages,
    deviceCapabilities: devices.capabilities,
    liveCapabilities: cap.capabilities,
    featurePlan: plan,
    blueprint: {
      category: blueprint.category,
      tabs: blueprint.tabs,
      collectionTabId: blueprint.collectionTabId,
      collectionActionLabel: blueprint.collectionActionLabel,
      hero: blueprint.hero,
      onboardingAngles: blueprint.onboardingAngles,
      featureWiring: blueprint.featureWiring,
      linkingRules: blueprint.linkingRules,
      wowBar: blueprint.wowBar,
      audienceVoice: blueprint.audienceVoice,
      onboardingArchetype: blueprint.onboardingArchetype,
    },
    psychologyHints: psychologyHintsFor(mp),
    onboardingPack: onboardingContextFor(mp),
    buildInstructions: plan.generationInstructions,
  };
}

function finalize(input: ExpoAppModelInput, mp: MasterBuildPrompt): ExpoAppModel {
  const cap = inferAppCapabilities(mp);
  const home = {
    ...input.home,
    heroLabel: input.home.heroLabel || cap.heroAction,
    heroSublabel: input.home.heroSublabel || cap.heroSublabel,
  };
  return {
    version: 1,
    ...input,
    home,
    theme: buildTheme(mp),
    capabilities: {
      enabled: cap.capabilities,
      uiFeatures: buildPreviewUiConfig(mp).features,
      heroAction: cap.heroAction,
      heroSublabel: cap.heroSublabel,
      visionPrompt: cap.visionPrompt,
    },
  };
}

async function generateWithLlm(
  mp: MasterBuildPrompt,
  projectId?: string
): Promise<ExpoAppModelInput | null> {
  const raw = await runWithBuildHeartbeat(
    projectId,
    {
      stepId: "generate",
      label: `Writing real copy for ${mp.features[0]?.toLowerCase() ?? "your app"}`,
      index: 2,
      total: 8,
      percent: 32,
      cap: 47,
    },
    () =>
      callPlanModel(
        GENERATE_SYSTEM,
        JSON.stringify(buildGenerationContext(mp)),
        true
      )
  );
  if (!raw) return null;
  const parsed = parseJsonFromText<ExpoAppModelInput>(raw);
  return parsed;
}

async function refineWithLlm(
  mp: MasterBuildPrompt,
  draft: ExpoAppModelInput,
  issues: string[],
  projectId?: string
): Promise<ExpoAppModelInput | null> {
  const raw = await runWithBuildHeartbeat(
    projectId,
    {
      stepId: "refine",
      label: "Polishing details",
      index: 4,
      total: 8,
      percent: 68,
      cap: 82,
    },
    () =>
      callPlanModel(
        GENERATE_SYSTEM +
          "\n\nYou are REFINING a draft. Fix EVERY issue listed. Keep structure; replace bad copy with real content.",
        JSON.stringify({ masterPrompt: mp, draft, issues }),
        true
      )
  );
  if (!raw) return null;
  return parseJsonFromText<ExpoAppModelInput>(raw);
}

/**
 * Multi-pass Expo app content build: generate → critique → refine (or premium seed fallback).
 */
export type BuildPhaseHandler = (
  stepId: string,
  label: string,
  index: number,
  percent: number
) => void;

const BUILD_PHASES = [
  { id: "plan", label: "Reading your plan…", percent: 8 },
  { id: "structure", label: "Shaping screen flow…", percent: 18 },
  { id: "generate", label: "Composing screens & copy…", percent: 38 },
  { id: "critique", label: "Checking quality…", percent: 58 },
  { id: "refine", label: "Polishing details…", percent: 72 },
  { id: "theme", label: "Applying colors & fonts…", percent: 86 },
  { id: "capabilities", label: "Wiring camera & live features…", percent: 94 },
  { id: "preview", label: "Loading your live preview…", percent: 100 },
] as const;

export async function buildExpoAppModel(
  mp: MasterBuildPrompt,
  projectId?: string,
  onPhase?: BuildPhaseHandler
): Promise<{ model: ExpoAppModel; passes: number; source: "llm" | "seed" }> {
  const total = BUILD_PHASES.length;
  const tick = (idx: number, label?: string) => {
    const phase = BUILD_PHASES[idx] ?? BUILD_PHASES[total - 1];
    const text = label ?? phase.label;
    onPhase?.(phase.id, text, idx, phase.percent);
    if (projectId) {
      setBuildProgress(projectId, {
        stepId: phase.id,
        label: text,
        index: idx,
        total,
        percent: phase.percent,
      });
    }
  };

  tick(0, `Reading ${mp.appName}'s plan…`);
  tick(1);

  let input: ExpoAppModelInput | null = null;
  let source: "llm" | "seed" = "llm";
  let passes = 0;

  if (integrations.planModel) {
    tick(2, `Writing real copy for ${mp.features[0]?.toLowerCase() ?? "your app"}…`);
    input = await generateWithLlm(mp, projectId);
    passes = 1;
    if (input) {
      input = enrichExpoContent(input, mp);
      tick(3, "Checking quality…");
      let critique = critiqueExpoApp(input);
      const enrichGaps = collectEnrichGaps(input, mp);
      const allIssues = [...critique.issues, ...enrichGaps];
      if (allIssues.length) {
        tick(4, "Polishing details…");
        const refined = await refineWithLlm(mp, input, allIssues, projectId);
        passes = 2;
        if (refined) {
          input = enrichExpoContent(refined, mp);
          critique = critiqueExpoApp(input);
          if (!critique.pass) {
            console.warn("[expoApp] refine still has issues:", critique.issues);
          }
        }
      } else {
        tick(4, "Copy looks good — skipping extra pass.");
      }
    }
  }

  if (!input) {
    tick(2, "Building from premium template…");
    input = seedExpoAppContent(mp);
    source = "seed";
    passes = passes === 0 ? 1 : passes;
    input = enrichExpoContent(input, mp);
  }

  const category = inferCategory(mp);
  if (integrations.imageGenModel) {
    tick(5, "Generating photos for your app…");
    input = await generateExpoImages(input, mp, category, projectId);
  }

  tick(5, `Applying ${mp.vibe.toLowerCase()} style & tailored fonts…`);
  tick(6);
  const model = finalize(input, mp);
  tick(7);

  if (projectId) {
    setBuildProgress(projectId, {
      stepId: "preview",
      label: "Your preview is ready →",
      index: total - 1,
      total,
      percent: 100,
      done: true,
    });
  }

  return { model, passes, source };
}
