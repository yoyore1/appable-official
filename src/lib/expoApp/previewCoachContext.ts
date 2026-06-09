import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import type { ExpoAppModel } from "./types";

export interface PreviewCoachContext {
  appName: string;
  spine: string;
}

/** Compact product + audience context for tap-to-ask and tap-to-fix. */
export function buildPreviewCoachContext(
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = [],
  model: ExpoAppModel | null = null
): PreviewCoachContext {
  const founderNotes = interview
    .filter((t) => t.answer?.trim())
    .slice(-4)
    .map((t) => t.answer.trim())
    .join(" · ");

  const spine = [
    `App: ${mp.appName}`,
    mp.description ? `What it does: ${mp.description}` : null,
    mp.audience ? `Audience: ${mp.audience}` : null,
    mp.twist ? `Their angle: ${mp.twist}` : null,
    mp.features.length
      ? `Core features: ${mp.features.slice(0, 6).join(", ")}`
      : null,
    mp.colors ? `Brand palette: ${mp.colors}` : null,
    model?.category ? `Category: ${model.category}` : null,
    model?.tabs.length
      ? `Screens in preview: ${model.tabs.map((t) => t.label).join(", ")}`
      : null,
    model?.flow?.roles?.length
      ? `User roles: ${model.flow.roles.map((r) => r.label).join(" / ")}`
      : null,
    founderNotes ? `Founder interview: ${founderNotes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return { appName: mp.appName, spine };
}

export function appendCoachContext(
  prompt: string,
  ctx: PreviewCoachContext | null | undefined
): string {
  if (!ctx?.spine.trim()) return prompt;
  return (
    `${prompt}\n\n` +
    `Stay specific to ${ctx.appName} and its audience — not generic app advice:\n` +
    ctx.spine
  );
}
