import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import type { ExpoAppModel } from "../types";
import { assignPreviewPatterns } from "../preview/assignPatterns";
import { applyCapabilityFixes } from "./apply";
import { attachAuditSnapshot, auditCapabilities } from "./audit";
import type { CapabilityId, CapabilityReviewResult } from "./types";

const DEFAULT_MAX_PASSES = 3;

export interface CapabilityReviewOptions {
  /** Build tweak: only fix gaps for these capabilities (+ deps). Omit = full initial build. */
  scope?: CapabilityId[];
  maxPasses?: number;
}

/**
 * Self-review: audit → auto-fix → re-audit.
 * Initial build: full app. Build tweak: pass `scope` from inferBuildReviewScope().
 */
export function runCapabilityReview(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = [],
  maxPasses: number = DEFAULT_MAX_PASSES,
  options: CapabilityReviewOptions = {}
): CapabilityReviewResult {
  const scope = options.scope;
  const auditOpts = scope?.length ? { scope } : {};
  const passLimit = options.maxPasses ?? maxPasses;

  let current = model;
  const allFixed: string[] = [];
  let passes = 0;
  let report = auditCapabilities(current, mp, interview, auditOpts);

  while (!report.pass && report.fixableCount > 0 && passes < passLimit) {
    const { model: patched, fixed } = applyCapabilityFixes(
      current,
      mp,
      interview,
      report,
      scope
    );
    if (fixed.length === 0) break;
    for (const f of fixed) {
      if (!allFixed.includes(f)) allFixed.push(f);
    }
    current = patched;
    passes += 1;
    report = auditCapabilities(current, mp, interview, auditOpts);
  }

  current = assignPreviewPatterns(current, mp, interview);

  // Readiness snapshot always reflects full app; scoped pass only changed part of the model.
  const fullReport = auditCapabilities(current, mp, interview);
  current = attachAuditSnapshot(current, fullReport, allFixed);

  return {
    model: current,
    report: scope?.length ? report : fullReport,
    passes,
    autoFixed: allFixed,
  };
}
