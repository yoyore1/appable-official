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
import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import { ensureActionPlan } from "./actionPlan";
import { attachBuildRecap } from "./buildRecap";
import { buildInterviewContext } from "./interviewContext";
import { inferProductSpec } from "./productSpec";
import { collectEnrichGaps, enrichExpoContent } from "./enrichContent";
import { enforceProductShape } from "./enforceProductShape";
import { buildAppBlueprint } from "./smartBlueprint";
import { buildFeaturePlan } from "./featurePlan";
import { buildPreviewUiConfig } from "./previewFeatures";
import { critiqueExpoApp } from "./critique";
import { generateExpoImages } from "./generateExpoImages";
import { inferCategory } from "./inferCategory";
import { seedExpoAppContent } from "./seedContent";
import { withLegalSettings } from "./smartInteractions";
import { buildTheme } from "./theme";
import { trackLlmCost } from "@/lib/aiBillingContext";
import { parseDeepInfraCost, type AiChatResult } from "@/lib/deepinfraCost";
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
  }, 2200);

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
): Promise<AiChatResult> {
  if (!integrations.planModel || !planModel.baseUrl || !planModel.key) {
    return { text: "", costUsd: 0 };
  }
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
  if (!res.ok) return { text: "", costUsd: 0 };
  const data = await res.json();
  const costUsd = parseDeepInfraCost(data);
  trackLlmCost(costUsd);
  const text = (data?.choices?.[0]?.message?.content ?? "").trim();
  return { text, costUsd };
}

function buildGenerateSystem(interviewCtx: ReturnType<typeof buildInterviewContext>): string {
  const { category, domainRules, forbidden } = interviewCtx;
  const cookingBlock =
    category === "cooking"
      ? `
COOKING-SPECIFIC (only because category is "cooking"):
- "recipes" tab with ingredients + steps on every item; lists tab tied to recipe names.
- detailType "recipe" with ingredients[] (6+) and steps[] (5+) on recipe items.
- hero matches photo→recipe ONLY if user asked for scan/camera.`
      : `
NON-COOKING APP (category "${category}"):
- Do NOT add recipes, ingredients, chef-hat tab, or grocery-from-recipe flows unless user explicitly asked for food/cooking.
- Use detailType "article" | "generic" | "list" — domain-appropriate bodies and steps.`;

  return `You are an expert React Native product designer. Output STRICT JSON for an ExpoAppModel (no markdown).

SOURCE OF TRUTH — THE INTERVIEW:
- context.interview.generationDirectives contains every Q&A from the user. Build the app from THAT.
- context.interview.userStatedFeatures MUST appear in tabs, hero, onboarding, and list copy.
- context.interview.essentialFeatures are smart additions — weave them in naturally.
- context.interview.signatureFeatures are niche-native UI moments (map, live session, calendar…) — user never asked; show them in real screens/copy.
- context.interview.signatureScreens are states to seed (active walk, booking confirm, etc.).
- context.interview.appShapes hint the product archetype — honor signatureFeatures for those shapes.
- context.blueprint.tabs defines tab ids/labels for THIS domain — follow exactly.

FULL APP (not a generic shell — build what the user described):
- If context.productSpec.hasDualRoles: include "flow" with roles[] + setupFields[] (profile wizard BEFORE main app).
- DUAL-ROLE (mandatory when productSpec.hasDualRoles): "homeByRole" keyed by role.id — each role gets its own headline, hero, sections.
- Tag list items with "forRole": role id (owner, walker, buyer…) OR omit forRole on shared items. Same tab ids; tabScreens items differ by forRole.
- context.topology.roleTabPlans tells you exactly what each role sees per tab — follow it.
- flow.welcomeTitle / welcomeSubtitle — clean welcome like a real shipped app.
- flow.setupTitle / setupSubtitle — e.g. "Tell us about you" with real form fields from productSpec.
- Every list item: tags[] (chips), quote? (owner note), primaryAction? (Accept Walk, Book, Save — domain CTA).
- Seed 4+ realistic items with specific names, places, dates, prices — never generic "Item 1".
- Include buildRecap: headline + sections[] (per role or per persona) + suggestedNext optional string.

QUALITY BAR (mandatory):
- NO placeholder text: never "Tap to explore", "Sample item", "Lorem", "Coming soon", empty cards.
- REAL domain content for THIS specific app — use the user's words and domain (walks, workouts, tasks, etc.).
- Onboarding: 2–3 slides AFTER setup (or 3 if no flow) — each DEMONSTRATES a real feature. NO slogans.
- tabs: 4 tabs — use ids/icons from blueprint (home, search, bell, user, list, heart, book-open, shopping-cart, settings, shield, help-circle).
- home: headline, subheadline, heroLabel, heroSublabel, sections[] with title + items[].
- tabScreens: keyed by tab id (not home/profile) with title, subtitle, items[] (4+ unique items).
- profile: displayName, tagline, stats[3], settings[4+] — domain-appropriate labels, then always end with "Sign out" and "Delete account".
- Set "category" field to "${category}".

FLOW SCHEMA (when dual-sided / marketplace):
{ "welcomeTitle", "welcomeSubtitle", "roles": [{ "id", "label", "description", "emoji" }], "setupTitle", "setupSubtitle", "setupFields": [{ "id", "label", "placeholder", "required", "kind", "options", "section" }] }

BUILD RECAP SCHEMA:
{ "headline": "${category} app is live!", "sections": [{ "title": "As a …", "bullets": ["…"] }], "suggestedNext": "optional next feature" }

FORBIDDEN:
${forbidden.map((f) => `- ${f}`).join("\n")}

DOMAIN RULES:
${domainRules.map((r) => `- ${r}`).join("\n")}
${cookingBlock}

ONBOARDING SLIDE SCHEMA:
{ "title", "subtitle", "imageUrl", "demonstrates", "ctaLabel", "kind": "feature_demo"|"personalization"|"value_prop"|"completion" }

LIST ITEM SCHEMA:
{ "id", "title", "subtitle", "meta", "badge?", "tags"?, "quote"?, "primaryAction"?, "forRole"?, "imageUrl", "detailType", "body", "steps": ["...", ...] (3+ steps) }

HOME BY ROLE SCHEMA (when dual-sided):
{ "owner": { "headline", "subheadline", "heroLabel", "heroSublabel", "sections": [...] }, "walker": { ... } }
${category === "cooking" ? '- Recipes also need "ingredients": ["qty + item", ...] (6+)' : ""}

IMPLICIT UI (preview wires these — include affordances in copy):
- save/favorite on detail cards; collection action when blueprint has collectionTabId
- profile settings rows are real and tappable — must include Sign out and Delete account (App Store requirement)
- when auth exists: show Continue with Google and Continue with Apple above email (recommended for launch)
- primaryAction on list items — each button gets a preview outcome (compose, status change, navigate, open detail). A separate pass reviews previewActions; still use domain-appropriate labels.

PREVIEW ACTIONS SCHEMA (optional in draft — refined in wiring pass):
{ "messagingTabId"?, "feedTabId"?, "rules": [{ "match", "kind", "toast", "navigateTabId"?, "statusBadge"?, "statusMeta"?, "nextPrimaryAction"?, "detailAppend"?, "composeTitle"?, "openDetailAfter"? }] }

${ONBOARDING_PSYCHOLOGY_RULES}

${PREMIUM_POLISH_RULES}`;
}

function buildGenerationContext(mp: MasterBuildPrompt, interview: InterviewTurn[] = []) {
  const devices = deviceFeaturesFor(mp);
  const interviewCtx = buildInterviewContext(mp, interview);
  const plan = buildFeaturePlan(mp, interview);
  const cap = inferAppCapabilities(mp, interview);
  const blueprint = buildAppBlueprint(mp, interview);
  const productSpec = inferProductSpec(mp, interview);
  return {
    masterPrompt: mp,
    productSpec,
    interview: {
      qaPairs: interviewCtx.qaPairs,
      category: interviewCtx.category,
      userStatedFeatures: interviewCtx.userStatedFeatures,
      essentialFeatures: interviewCtx.essentialFeatures,
      signatureFeatures: interviewCtx.signatureFeatures,
      signatureScreens: interviewCtx.signatureScreens,
      appShapes: interviewCtx.appShapes,
      generationDirectives: interviewCtx.generationDirectives,
      forbidden: interviewCtx.forbidden,
    },
    topology: {
      hasDualRoles: interviewCtx.topology.hasDualRoles,
      topology: interviewCtx.topology.topology,
      roles: interviewCtx.topology.roles,
      tabs: interviewCtx.topology.tabs,
      roleTabPlans: interviewCtx.topology.roleTabPlans,
      buildDirectives: interviewCtx.topology.buildDirectives,
    },
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
    psychologyHints: psychologyHintsFor(mp, interviewCtx.category),
    onboardingPack: onboardingContextFor(mp),
    buildInstructions: plan.generationInstructions,
  };
}

function finalize(
  input: ExpoAppModelInput,
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): ExpoAppModel {
  const cap = inferAppCapabilities(mp, interview);
  const home = {
    ...input.home,
    heroLabel: input.home.heroLabel || cap.heroAction,
    heroSublabel: input.home.heroSublabel || cap.heroSublabel,
  };
  const shaped = enforceProductShape({ ...input, home }, mp, interview);

  const base: ExpoAppModel = {
    version: 1,
    ...shaped,
    home: shaped.home,
    theme: buildTheme(mp),
    capabilities: {
      enabled: cap.capabilities,
      uiFeatures: buildPreviewUiConfig(mp, interview).features,
      heroAction: cap.heroAction,
      heroSublabel: cap.heroSublabel,
      visionPrompt: cap.visionPrompt,
    },
  };
  return withLegalSettings(attachBuildRecap(base, mp, interview));
}

async function generateWithLlm(
  mp: MasterBuildPrompt,
  projectId?: string,
  interview: InterviewTurn[] = []
): Promise<ExpoAppModelInput | null> {
  const ctx = buildGenerationContext(mp, interview);
  const system = buildGenerateSystem(buildInterviewContext(mp, interview));
  const raw = await runWithBuildHeartbeat(
    projectId,
    {
      stepId: "generate",
      label: `Writing real copy for ${mp.features[0]?.toLowerCase() ?? "your app"}`,
      index: 2,
      total: 8,
      percent: 28,
      cap: 46,
    },
    () => callPlanModel(system, JSON.stringify(ctx), true)
  );
  if (!raw.text) return null;
  const parsed = parseJsonFromText<ExpoAppModelInput>(raw.text);
  return parsed;
}

async function refineWithLlm(
  mp: MasterBuildPrompt,
  draft: ExpoAppModelInput,
  issues: string[],
  projectId?: string,
  interview: InterviewTurn[] = []
): Promise<ExpoAppModelInput | null> {
  const system =
    buildGenerateSystem(buildInterviewContext(mp, interview)) +
    "\n\nYou are REFINING a draft. Fix EVERY issue listed. Keep structure; replace bad copy with real domain content from the interview.";
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
        system,
        JSON.stringify({
          ...buildGenerationContext(mp, interview),
          draft,
          issues,
        }),
        true
      )
  );
  if (!raw.text) return null;
  return parseJsonFromText<ExpoAppModelInput>(raw.text);
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
  { id: "plan", label: "Reading your interview…", percent: 6 },
  { id: "structure", label: "Shaping screen flow…", percent: 14 },
  { id: "generate", label: "Composing screens & copy…", percent: 28 },
  { id: "critique", label: "Checking quality…", percent: 48 },
  { id: "refine", label: "Polishing details…", percent: 62 },
  { id: "theme", label: "Applying colors & fonts…", percent: 76 },
  { id: "capabilities", label: "Wiring interactions…", percent: 88 },
  { id: "preview", label: "Loading your live preview…", percent: 96 },
] as const;

export async function buildExpoAppModel(
  mp: MasterBuildPrompt,
  projectId?: string,
  onPhase?: BuildPhaseHandler,
  interview: InterviewTurn[] = []
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
    input = await generateWithLlm(mp, projectId, interview);
    passes = 1;
    if (input) {
      input = enrichExpoContent(input, mp, interview);
      tick(3, "Checking quality…");
      let critique = critiqueExpoApp(input, interview, mp);
      const enrichGaps = collectEnrichGaps(input, mp, interview);
      const allIssues = [...critique.issues, ...enrichGaps];
      if (allIssues.length) {
        tick(4, "Polishing details…");
        const refined = await refineWithLlm(mp, input, allIssues, projectId, interview);
        passes = 2;
        if (refined) {
          input = enrichExpoContent(refined, mp, interview);
          critique = critiqueExpoApp(input, interview, mp);
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
    input = seedExpoAppContent(mp, interview);
    source = "seed";
    passes = passes === 0 ? 1 : passes;
    input = enrichExpoContent(input, mp, interview);
  }

  const category = inferCategory(mp, interview);
  if (integrations.imageGenModel) {
    tick(5, "Generating photos for your app…");
    input = await generateExpoImages(input, mp, category, projectId);
  }

  tick(5, `Applying ${mp.vibe.toLowerCase()} style & tailored fonts…`);
  tick(6, "Wiring button interactions…");
  input = await ensureActionPlan(input, mp, interview);
  const model = finalize(input, mp, interview);
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
