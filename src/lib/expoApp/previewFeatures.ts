import { inferCategory, type AppCategory } from "./inferCategory";
import type { ExpoAppModel } from "./types";
import type { MasterBuildPrompt } from "@/lib/types";

/**
 * Free in-preview UI — inferred for EVERY app type.
 * Obvious affordances users expect even if they didn't say them verbatim.
 */
export type PreviewUiFeature =
  | "save_favorite"
  | "add_to_collection"
  | "share";

export interface PreviewUiConfig {
  features: PreviewUiFeature[];
  /** Label on detail CTA, e.g. "Add to shopping list". */
  collectionActionLabel: string;
  /** Tab id to push collection items into. */
  collectionTabId: string | null;
  category: AppCategory;
}

const COLLECTION_LABEL: Record<AppCategory, string> = {
  cooking: "Add to shopping list",
  pets: "Save walker",
  fitness: "Add to my plan",
  productivity: "Add to my list",
  shopping: "Add to cart",
  education: "Save to library",
  social: "Save to collection",
  general: "Add to collection",
};

function blobFromMp(mp: MasterBuildPrompt): string {
  return [mp.description, mp.audience, mp.twist ?? "", ...mp.features, mp.appName]
    .join(" ")
    .toLowerCase();
}

function blobFromModel(model: ExpoAppModel): string {
  return [
    model.category,
    model.home.headline,
    model.home.subheadline,
    ...model.tabs.map((t) => `${t.id} ${t.label}`),
    ...Object.values(model.tabScreens).flatMap((s) => [s.title, s.subtitle]),
  ]
    .join(" ")
    .toLowerCase();
}

function findCollectionTabId(
  tabs: ExpoAppModel["tabs"]
): string | null {
  const hit = tabs.find((t) =>
    /list|grocery|shop|cart|plan|library|task|collection|wish|check/i.test(
      `${t.id} ${t.label}`
    )
  );
  if (hit) return hit.id;
  const secondary = tabs.find((t) => t.id !== "home" && t.id !== "profile");
  return secondary?.id ?? null;
}

function collectionLabel(category: AppCategory, blob: string): string {
  if (/grocery|ingredient|shop/.test(blob)) return "Add to shopping list";
  if (/cart|buy|store/.test(blob)) return "Add to cart";
  if (/workout|train|gym|plan/.test(blob)) return "Add to my plan";
  if (/task|todo|habit|checklist/.test(blob)) return "Add to my list";
  if (/lesson|course|learn|read/.test(blob)) return "Save to library";
  return COLLECTION_LABEL[category];
}

/** Core rules — same for interview build and live preview fallback. */
export function inferUiFeatures(
  blob: string,
  category: AppCategory
): PreviewUiFeature[] {
  const out = new Set<PreviewUiFeature>();

  // Preview always wires these — no backend required
  out.add("save_favorite");
  out.add("add_to_collection");
  out.add("share");

  const listy =
    /list|grocery|shop|cart|plan|collection|library|task|todo|checklist|wish|ingredient|schedule/.test(
      blob
    );

  // Link detail → collection tab when lists/plans/carts are part of the app
  if (
    listy ||
    category === "cooking" ||
    category === "productivity" ||
    category === "shopping" ||
    category === "fitness" ||
    category === "education"
  ) {
    out.add("add_to_collection");
  }

  return [...out];
}

export function buildPreviewUiConfig(mp: MasterBuildPrompt): PreviewUiConfig {
  const category = inferCategory(mp);
  const blob = blobFromMp(mp);
  return {
    category,
    features: inferUiFeatures(blob, category),
    collectionActionLabel: collectionLabel(category, blob),
    collectionTabId: null,
  };
}

export function buildPreviewUiConfigFromModel(
  model: ExpoAppModel
): PreviewUiConfig {
  const category = (model.category as AppCategory) || inferCategory({
    appName: model.home.headline,
    description: model.home.subheadline,
    audience: "",
    twist: null,
    features: [],
    layoutArchetype: "",
    vibe: "Soft",
    colors: "",
    screens: [],
    referenceApp: null,
  });
  const blob = blobFromModel(model);
  return {
    category,
    features: inferUiFeatures(blob, category),
    collectionActionLabel: collectionLabel(category, blob),
    collectionTabId: findCollectionTabId(model.tabs),
  };
}

/** @deprecated Use buildPreviewUiConfig().features */
export function inferPreviewUiFeatures(mp: MasterBuildPrompt): PreviewUiFeature[] {
  return buildPreviewUiConfig(mp).features;
}

/** Map legacy stored capability ids. */
const PREVIEW_ALWAYS_ON: PreviewUiFeature[] = [
  "save_favorite",
  "add_to_collection",
  "share",
];

export function uiFeatureEnabled(
  uiFeatures: string[] | undefined,
  feature: PreviewUiFeature
): boolean {
  if (PREVIEW_ALWAYS_ON.includes(feature)) return true;
  if (!uiFeatures?.length) return false;
  const legacy: Record<PreviewUiFeature, string[]> = {
    save_favorite: ["save_favorite", "save_recipe"],
    add_to_collection: ["add_to_collection", "grocery_from_recipe"],
    share: ["share", "share_list"],
  };
  return legacy[feature].some((id) => uiFeatures.includes(id));
}
