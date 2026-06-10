import {
  formatPreviewBuildStateBlock,
  type PreviewBuildState,
} from "./previewBuildState";
import type { ExpoAppModel } from "./types";

/** Preview screen context for Brainstorm — grounds advice without claiming a shared viewport. */
export function formatPreviewContextForBrainstorm(
  state: PreviewBuildState | undefined,
  model: ExpoAppModel | null | undefined
): string {
  if (!state || !model) return "";

  const block = formatPreviewBuildStateBlock(state, model);
  if (!block) return "";

  return (
    `${block}\n` +
    `(The founder may have this screen open in the phone preview. Do NOT say "you're looking at" or ` +
    `"on your screen" — refer to "the setup screen" / "the role picker" / etc.)`
  );
}
