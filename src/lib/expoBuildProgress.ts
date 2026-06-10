import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import { buildInterviewContext } from "@/lib/expoApp/interviewContext";
import { inferProductSpec } from "@/lib/expoApp/productSpec";

export interface ExpoBuildStep {
  id: string;
  label: string;
  /** Target percent when this step becomes active (0–100). */
  percent: number;
}

function humanFeature(feature: string): string {
  const f = feature.trim();
  if (f.length < 4) return "your core workflow";
  if (f.length > 48) return `${f.slice(0, 45).replace(/\s+\S*$/, "")}…`;
  return f;
}

/** Tailored micro-steps for the build card — from interview, not raw feature[0]. */
export function expoBuildMicroSteps(
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): ExpoBuildStep[] {
  const ctx = buildInterviewContext(mp, interview);
  const spec = inferProductSpec(mp, interview);
  const f0 = humanFeature(mp.features[0] ?? ctx.userStatedFeatures[0] ?? "main feature");
  const f1 = humanFeature(mp.features[1] ?? ctx.userStatedFeatures[1] ?? "secondary tab");
  const layout = mp.layoutArchetype.replace(/-/g, " ");

  const steps: ExpoBuildStep[] = [
    { id: "read", label: `Reading everything you said about ${mp.appName}…`, percent: 4 },
    { id: "domain", label: `Locking in the ${ctx.category} app structure…`, percent: 9 },
    { id: "archetype", label: `Shaping the ${layout} screen flow…`, percent: 14 },
  ];

  if (spec.hasDualRoles) {
    steps.push(
      { id: "roles", label: `Adding ${spec.roles.map((r) => r.label).join(" & ")} role selection…`, percent: 20 },
      { id: "setup", label: "Building the profile setup wizard…", percent: 26 }
    );
  }

  steps.push(
    { id: "onboard", label: "Crafting onboarding that shows real features…", percent: 32 },
    { id: "home", label: `Designing Home around ${f0}…`, percent: 40 },
    { id: "tab1", label: `Building the ${f1} experience…`, percent: 48 },
    { id: "copy", label: "Writing domain-specific copy from your interview…", percent: 56 },
    { id: "seed", label: "Seeding realistic sample data…", percent: 64 },
    { id: "actions", label: "Wiring primary actions on every card…", percent: 72 },
    { id: "polish", label: "Adding profile stats & settings…", percent: 78 },
    { id: "expo", label: "Writing real Expo Router app (React Native)…", percent: 84 },
    { id: "agent", label: "Code agent wiring screens to your plan…", percent: 90 },
    { id: "compile", label: "Compiling your real app for the live phone…", percent: 96 }
  );

  return steps;
}

/** @deprecated Use expoBuildMicroSteps */
export function expoBuildSteps(mp: MasterBuildPrompt): { id: string; label: string }[] {
  return expoBuildMicroSteps(mp).map(({ id, label }) => ({ id, label }));
}
