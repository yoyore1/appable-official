import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import type { ExpoAppModel } from "../types";
import { runCapabilityChecks } from "./checks";
import { detectRequiredCapabilities } from "./registry";
import { scopeNeedsActionPlan } from "./scope";
import type {
  CapabilityAuditReport,
  CapabilityAuditSnapshot,
  CapabilityGap,
  CapabilityId,
  CapabilityStatus,
} from "./types";

export interface AuditCapabilitiesOptions {
  /** Build tweak: only audit these (+ related global checks). Omit = full app. */
  scope?: CapabilityId[];
}

export function auditCapabilities(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = [],
  options: AuditCapabilitiesOptions = {}
): CapabilityAuditReport {
  const appRequired = detectRequiredCapabilities(mp, interview);
  const required = options.scope?.length
    ? options.scope.filter((id) => appRequired.includes(id))
    : appRequired;

  const { results, globalGaps: allGlobal } = runCapabilityChecks(model, required);
  const globalGaps =
    options.scope?.length && !scopeNeedsActionPlan(options.scope)
      ? allGlobal.filter((g) => g.id !== "global-action-plan" && !g.id.startsWith("global-plan"))
      : allGlobal;

  const allGaps: CapabilityGap[] = [
    ...globalGaps,
    ...results.flatMap((r) => r.gaps),
  ];
  const fixableCount = allGaps.filter((g) => g.fixable && !g.suggestOnly).length;
  const suggestCount = allGaps.filter((g) => g.suggestOnly).length;
  const blocking = allGaps.filter((g) => !g.suggestOnly && g.layer === "behavior");
  const pass = blocking.length === 0 && fixableCount === 0;

  return {
    required: options.scope?.length ? options.scope : appRequired,
    results,
    globalGaps,
    pass,
    fixableCount,
    suggestCount,
  };
}

export function capabilityGapsToCritiqueIssues(report: CapabilityAuditReport): string[] {
  return [
    ...report.globalGaps,
    ...report.results.flatMap((r) => r.gaps),
  ]
    .filter((g) => !g.suggestOnly)
    .map((g) => `[${g.capability}/${g.layer}] ${g.message}`);
}

export function snapshotFromReport(report: CapabilityAuditReport): CapabilityAuditSnapshot {
  const statusByCapability: Partial<Record<CapabilityId, CapabilityStatus>> = {};
  for (const r of report.results) {
    statusByCapability[r.capability] = r.status;
  }
  return {
    required: report.required,
    statusByCapability,
    pass: report.pass,
    auditedAt: new Date().toISOString(),
    autoFixed: [],
  };
}

/** Readiness helper — score a single capability for checklist UI. */
export function capabilityReadinessStatus(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  interview: InterviewTurn[],
  capability: CapabilityId
): CapabilityStatus {
  const report = auditCapabilities(model, mp, interview);
  const hit = report.results.find((r) => r.capability === capability);
  return hit?.status ?? "missing";
}

export function attachAuditSnapshot(
  model: ExpoAppModel,
  report: CapabilityAuditReport,
  autoFixed: string[] = []
): ExpoAppModel {
  const snapshot = snapshotFromReport(report);
  snapshot.autoFixed = autoFixed;
  return { ...model, capabilityAudit: snapshot };
}
