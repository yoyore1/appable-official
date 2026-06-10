import { integrations } from "@/lib/config";
import { isComplexBuildRequest } from "@/lib/expoApp/buildAgent";
import { isPreviewModelTweakRequest } from "@/lib/expoApp/brainstormGuidance";

const COPY_TWEAK_RE =
  /\b(copy|wording|subtitle|headline|title|welcome|replace|rewrite|shorter|friendlier|clearer|cta|label|tagline|description|text line|exact wording)\b/i;

const STRUCTURAL_RE =
  /\b(new tab|new screen|remove tab|delete tab|add tab|wire|implement|integrate|connect|fix broken|not working|refactor|component|navigation)\b/i;

/**
 * Code agent = slow multi-step file editor. Use only when fast paths can't handle it.
 */
export function shouldUseCodeAgent(
  message: string,
  opts?: { fromBrainstormApply?: boolean; projectId?: string }
): boolean {
  if (!integrations.codeAgent) return false;
  if (!opts?.projectId) return false;

  const msg = message.trim();
  if (!msg) return false;

  if (isPreviewModelTweakRequest(msg)) return false;

  if (opts.fromBrainstormApply) {
    if (isComplexBuildRequest(msg) || STRUCTURAL_RE.test(msg)) return true;
    if (COPY_TWEAK_RE.test(msg) || /preview copy|discussed in brainstorm/i.test(msg)) {
      return false;
    }
    return false;
  }

  if (isComplexBuildRequest(msg) || STRUCTURAL_RE.test(msg)) return true;

  if (COPY_TWEAK_RE.test(msg) && !STRUCTURAL_RE.test(msg)) return false;

  if (/^set\s+.+\s+to\s+["']/i.test(msg)) return false;

  return false;
}
