export type {
  CapabilityId,
  CapabilityStatus,
  CapabilityGap,
  CapabilityCheckResult,
  CapabilityAuditReport,
  CapabilityAuditSnapshot,
  CapabilityReviewResult,
  CheckLayer,
} from "./types";

export { detectRequiredCapabilities, capabilityLabel } from "./registry";
export {
  auditCapabilities,
  capabilityGapsToCritiqueIssues,
  capabilityReadinessStatus,
  snapshotFromReport,
  attachAuditSnapshot,
} from "./audit";
export { runCapabilityChecks, auditGlobal } from "./checks";
export { applyCapabilityFixes } from "./apply";
export { runCapabilityReview, type CapabilityReviewOptions } from "./reviewLoop";
export {
  inferBuildReviewScope,
  expandCapabilityScope,
  scopeNeedsActionPlan,
  type BuildReviewScope,
} from "./scope";
export { type AuditCapabilitiesOptions } from "./audit";
