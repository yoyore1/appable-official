/** Product capabilities the builder understands — same pipeline for every app type. */
export type CapabilityId =
  | "auth_accounts"
  | "dual_roles"
  | "content_browse"
  | "collection"
  | "messaging"
  | "marketplace_match"
  | "status_workflow"
  | "booking"
  | "commerce"
  | "social_feed"
  | "live_tracking"
  | "payments"
  | "habit_streak"
  | "journal";

export type CheckLayer = "behavior" | "ux" | "ui";

export type CapabilityStatus = "have" | "partial" | "missing";

export interface CapabilityGap {
  capability: CapabilityId | "global";
  layer: CheckLayer;
  id: string;
  message: string;
  /** Deterministic expander can fix this in the preview model. */
  fixable: boolean;
  /** Product choice — surface in brainstorm, do not auto-add. */
  suggestOnly?: boolean;
}

export interface CapabilityCheckResult {
  capability: CapabilityId;
  status: CapabilityStatus;
  gaps: CapabilityGap[];
}

export interface CapabilityAuditReport {
  required: CapabilityId[];
  results: CapabilityCheckResult[];
  globalGaps: CapabilityGap[];
  pass: boolean;
  fixableCount: number;
  suggestCount: number;
}

/** Persisted on ExpoAppModel after build / tweak review. */
export interface CapabilityAuditSnapshot {
  required: CapabilityId[];
  statusByCapability: Partial<Record<CapabilityId, CapabilityStatus>>;
  pass: boolean;
  auditedAt: string;
  autoFixed: string[];
}

export interface CapabilityReviewResult {
  model: import("../types").ExpoAppModel;
  report: CapabilityAuditReport;
  passes: number;
  autoFixed: string[];
}
