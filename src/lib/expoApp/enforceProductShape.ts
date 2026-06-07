/**
 * Deterministic fixes after Kimi generate — topology features must not depend on LLM compliance.
 */
import { buildInterviewContext } from "./interviewContext";
import { imageForCategory } from "./images";
import type { AppCategory } from "./inferCategory";
import { flowFromSpec, inferProductSpec } from "./productSpec";
import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import type {
  ExpoAppModelInput,
  ExpoHomeSection,
  ExpoListItem,
} from "./types";
import type { RoleTabPlan } from "./appTopology";

function modelText(input: ExpoAppModelInput): string {
  return JSON.stringify({
    home: input.home,
    homeByRole: input.homeByRole,
    tabs: input.tabs,
    tabScreens: input.tabScreens,
  }).toLowerCase();
}

function hasMapInModel(input: ExpoAppModelInput): boolean {
  return /map|gps|live map|nearby pin|open map|view map/i.test(modelText(input));
}

function needsMapCard(ctx: ReturnType<typeof buildInterviewContext>): boolean {
  if (ctx.category === "pets") return true;
  return ctx.appShapes.some((s) =>
    ["local_marketplace", "live_tracking", "outdoor_trails", "real_estate"].includes(s)
  );
}

function mapCardItem(category: string, forRole?: string): ExpoListItem {
  return {
    id: "home-map-card",
    title: "Nearby on the map",
    subtitle: "Open requests and active sessions near you",
    meta: "Map view",
    badge: "Map",
    tags: ["Map", "Nearby"],
    primaryAction: "Open map",
    imageUrl: imageForCategory(category, 12),
    detailType: "article",
    body:
      "Interactive map with pins for nearby requests. Tap a pin to view details, distance, and match status.",
    ...(forRole ? { forRole } : {}),
  };
}

function prependMapSection(
  sections: ExpoHomeSection[],
  category: string,
  forRole?: string
): ExpoHomeSection[] {
  if (sections.some((s) => /map/i.test(s.title))) return sections;
  return [{ title: "Map", items: [mapCardItem(category, forRole)] }, ...sections];
}

function roleHomeFromPlan(
  plan: RoleTabPlan,
  fallbackSections: ExpoHomeSection[],
  category: string
): {
  headline: string;
  subheadline: string;
  heroLabel: string;
  heroSublabel: string;
  sections: ExpoHomeSection[];
} {
  const isOwner = plan.roleId === "owner" || /client|buyer|guest|learner/i.test(plan.roleId);
  let sections = [...fallbackSections];
  if (isOwner && /map|track/i.test(plan.signatures.join(" ") + plan.tabPurposes.home)) {
    sections = prependMapSection(sections, category, plan.roleId);
  }
  return {
    headline: plan.homeHeadline,
    subheadline: plan.homeSubheadline,
    heroLabel: plan.heroLabel,
    heroSublabel: plan.heroSublabel,
    sections,
  };
}

function buildHomeByRole(
  input: ExpoAppModelInput,
  plans: RoleTabPlan[],
  category: string
): ExpoAppModelInput["homeByRole"] {
  const baseSections = input.home.sections ?? [];
  return Object.fromEntries(
    plans.map((plan) => [plan.roleId, roleHomeFromPlan(plan, baseSections, category)])
  );
}

function mergeFlow(
  input: ExpoAppModelInput,
  spec: ReturnType<typeof inferProductSpec>
): ExpoAppModelInput["flow"] {
  const specFlow = flowFromSpec(spec);
  if (!specFlow?.roles?.length) return input.flow ?? specFlow;

  const existing = input.flow ?? {};
  return {
    welcomeTitle: existing.welcomeTitle ?? specFlow.welcomeTitle,
    welcomeSubtitle: existing.welcomeSubtitle ?? specFlow.welcomeSubtitle,
    setupTitle: existing.setupTitle ?? specFlow.setupTitle,
    setupSubtitle: existing.setupSubtitle ?? specFlow.setupSubtitle,
    roles:
      existing.roles?.length && existing.roles.length >= 2
        ? existing.roles
        : specFlow.roles,
    setupFields:
      existing.setupFields?.length && existing.setupFields.length >= 2
        ? existing.setupFields
        : specFlow.setupFields,
  };
}

/** Gaps Kimi often skips — fed into critique / refine. */
export function collectTopologyGaps(
  input: ExpoAppModelInput,
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): string[] {
  const spec = inferProductSpec(mp, interview);
  const ctx = buildInterviewContext(mp, interview);
  const issues: string[] = [];

  if (!spec.hasDualRoles) return issues;

  if (!input.flow?.roles || input.flow.roles.length < 2) {
    issues.push(
      "DUAL-ROLE APP: flow.roles[] must have owner + walker (or both sides) — user picks role on first open"
    );
  }
  if (!input.homeByRole || Object.keys(input.homeByRole).length < 2) {
    issues.push(
      "DUAL-ROLE APP: homeByRole object required — separate home headline/hero/sections per role id"
    );
  }
  if (needsMapCard(ctx) && !hasMapInModel(input)) {
    issues.push(
      "Local / pet marketplace app needs a map card or live-map section on Home (owner side)"
    );
  }

  return issues;
}

/**
 * Merge product spec + topology into model when the LLM omitted mandatory structure.
 */
export function enforceProductShape(
  input: ExpoAppModelInput,
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): ExpoAppModelInput {
  const ctx = buildInterviewContext(mp, interview);
  const spec = inferProductSpec(mp, interview);
  const topology = ctx.topology;
  const category = (input.category ?? ctx.category) as AppCategory;

  let next: ExpoAppModelInput = { ...input };

  if (spec.hasDualRoles && spec.roles.length >= 2) {
    next.flow = mergeFlow(next, spec);

    if (topology.tabs.length) {
      next.tabs = topology.tabs.map(({ id, label, icon }) => ({ id, label, icon }));
    }

    const roleCount = Object.keys(next.homeByRole ?? {}).length;
    if (roleCount < 2 && topology.roleTabPlans.length >= 2) {
      next.homeByRole = buildHomeByRole(next, topology.roleTabPlans, category);
    }
  }

  if (needsMapCard(ctx) && !hasMapInModel(next)) {
    next = {
      ...next,
      home: {
        ...next.home,
        sections: prependMapSection(next.home.sections ?? [], category, "owner"),
      },
    };
    if (next.homeByRole?.owner) {
      next.homeByRole = {
        ...next.homeByRole,
        owner: {
          ...next.homeByRole.owner,
          sections: prependMapSection(next.homeByRole.owner.sections, category, "owner"),
        },
      };
    }
  }

  return next;
}
