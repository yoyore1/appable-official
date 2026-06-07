import type { MasterBuildPrompt } from "@/lib/types";

export interface ExpoBuildStep {
  id: string;
  label: string;
}

/** Tailored build progress copy — shown in the build card, not spammed into chat. */
export function expoBuildSteps(mp: MasterBuildPrompt): ExpoBuildStep[] {
  const primary = mp.features[0]?.toLowerCase() ?? "your core feature";
  const secondary = mp.features[1]?.toLowerCase();
  const layout = mp.layoutArchetype.replace(/-/g, " ");
  const colorHint = mp.colors.split(/[,&]/)[0]?.trim().toLowerCase() ?? "your palette";

  const steps: ExpoBuildStep[] = [
    { id: "plan", label: `Reading ${mp.appName}'s plan…` },
    { id: "structure", label: `Shaping the ${layout} screen flow…` },
    { id: "onboarding", label: "Crafting a 3-step onboarding…" },
    { id: "copy", label: `Writing real copy for ${primary}…` },
  ];

  if (secondary) {
    steps.push({
      id: "tabs",
      label: `Building ${secondary} & tab screens…`,
    });
  } else {
    steps.push({ id: "tabs", label: "Wiring tabs & navigation…" });
  }

  steps.push(
    {
      id: "theme",
      label: `Applying ${mp.vibe.toLowerCase()} style & ${colorHint}…`,
    },
    { id: "polish", label: "Adding profile, stats & finishing touches…" },
    { id: "preview", label: "Loading your live preview…" }
  );

  return steps;
}
