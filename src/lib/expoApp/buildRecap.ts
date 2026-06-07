import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import type { ExpoAppModel, ExpoBuildRecap } from "./types";
import { inferProductSpec, recapFromSpec } from "./productSpec";

/** Markdown recap for the build room chat — Replit-style. */
export function formatBuildRecap(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): string {
  const recap =
    model.buildRecap ??
    recapFromSpec(mp, inferProductSpec(mp, interview), interview);
  const lines: string[] = [`**${recap.headline}**`, ""];

  for (const sec of recap.sections) {
    lines.push(`**${sec.title}**`);
    for (const b of sec.bullets) {
      lines.push(`• ${b}`);
    }
    lines.push("");
  }

  if (model.flow?.roles?.length) {
    lines.push(
      `_Opens with role selection (${model.flow.roles.map((r) => r.label).join(" / ")}) then a quick profile setup._`
    );
    lines.push("");
  }

  lines.push(
    "Tap any card in the preview → **Save**, collection actions, and profile settings all work."
  );

  if (recap.suggestedNext) {
    lines.push("");
    lines.push(`**Next up?** ${recap.suggestedNext}`);
  }

  return lines.join("\n").trim();
}

export function attachBuildRecap(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): ExpoAppModel {
  if (model.buildRecap) return model;
  return {
    ...model,
    buildRecap: recapFromSpec(mp, inferProductSpec(mp, interview), interview),
  };
}
