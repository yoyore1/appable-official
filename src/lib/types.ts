export type Vibe = "Cinematic" | "Minimal" | "Bold" | "Soft" | "Luxury";

export interface UserAccount {
  id: string;
  email: string;
  name: string | null;
  depositPaid: boolean;
  buildPower: number;
  reviewBalance: number;
  dataSharingOptIn: boolean;
  isAdmin: boolean;
  courseTierId: string | null;
  /** Set when the user buys any build-power usage pack (removes preview watermark). */
  usagePackPurchased?: boolean;
  /** Free-tier live AI spend (USD) — capped at ~$0.55 per models-polish spec. */
  aiUsageUsd: number;
  /** TTS characters consumed on free tier (hard-capped). */
  ttsCharsUsed: number;
  createdAt: string;
}

export type ProjectStatus =
  | "interviewing"
  | "ready" // master prompt generated, ready for builder handoff
  | "building"
  | "live";

/** Which app the Builder generates. RN = React Native + Expo (runs anywhere,
 *  the accessible default). Swift = native SwiftUI (desktop-only, recommended). */
export type BuildTarget = "rn" | "swift";

/** The structured handoff artifact the build engine fetches by project ID. */
export interface MasterBuildPrompt {
  appName: string;
  description: string;
  audience: string;
  /** What makes their version original (reference path); null on full interview. */
  twist: string | null;
  features: string[];
  /** Internal blueprint — drives template assembly downstream. */
  layoutArchetype: string;
  vibe: Vibe;
  colors: string;
  screens: string[];
  /** Named reference app, if any — never copied visually. */
  referenceApp: string | null;
}

export interface LaunchAssets {
  purchased: boolean;
  aso?: {
    title: string;
    subtitle: string;
    keywords: string[];
    description: string;
  };
  screenshots?: { url: string; caption: string }[];
  icon?: { url: string };
  videoAds?: { title: string; script: string; spec: string }[];
}

export interface LegalDocs {
  privacyUrl?: string;
  termsUrl?: string;
  supportUrl?: string;
}

export interface InterviewTurn {
  questionId: string;
  question: string;
  answer: string;
}

/** Server-prefetched pills for the next interview step (landing handoff). */
export interface InterviewStepPrefetch {
  stepId: string;
  suggestions: string[];
  appablePick: string;
}

/** User progress on launch-readiness checklist (Phase 2 brainstorm). */
export type ReadinessDecision = "done" | "yes" | "later" | "skip";

export interface ReadinessItemState {
  discussed: boolean;
  discussedAt?: string;
  decision?: ReadinessDecision | null;
}

export interface ProjectReadinessState {
  items: Record<string, ReadinessItemState>;
  pinnedItemId?: string | null;
  lastAuditAt?: string;
}

/** One turn in post-build brainstorm chat (persisted on the project). */
export type BrainstormTurn = { role: "user" | "assistant"; content: string };

/** Actionable preview change surfaced by brainstorm → hand off to Build tab. */
export interface BrainstormBuildSuggestion {
  label: string;
  prompt: string;
}

/** Persisted brainstorm thread + rolling summary for Build agent context. */
export interface ProjectBrainstormState {
  history: BrainstormTurn[];
  summary: string;
  pendingBuild?: BrainstormBuildSuggestion | null;
}

export type SupabaseConnectorStatus = "connected" | "setup_failed" | "disconnected";

/** Safe to show in UI — no API keys. */
export interface SupabaseConnectorPublic {
  projectRef: string;
  projectName: string;
  url: string;
  region?: string | null;
  status: SupabaseConnectorStatus;
  connectedAt: string;
  schemaVersion: number;
  setupError?: string | null;
  /** POST target for Supabase database webhooks (profile sync → RevenueCat). */
  webhookUrl?: string;
}

/** Encrypted Supabase link for a project (BYO — user's own Supabase org). */
export interface ProjectSupabaseConnector {
  public: SupabaseConnectorPublic;
  anonKeyEnc: string;
  serviceRoleKeyEnc: string;
  /** Verifies POST /api/webhooks/supabase/[projectId] */
  webhookSecretEnc?: string;
  /** Supabase management token — lets Build run schema extensions (encrypted). */
  managementTokenEnc?: string;
}

export type RevenueCatConnectorStatus = "connected" | "disconnected";

export interface RevenueCatConnectorPublic {
  status: RevenueCatConnectorStatus;
  connectedAt: string;
  publicApiKeyHint: string;
  webhookUrl: string;
  webhooksConfigured: boolean;
}

/** Encrypted RevenueCat keys + webhook auth for a project. */
export interface ProjectRevenueCatConnector {
  public: RevenueCatConnectorPublic;
  publicApiKeyEnc: string;
  secretApiKeyEnc: string;
  webhookSecretEnc: string;
}

export type RailwayConnectorStatus = "connected" | "disconnected";

export interface RailwayConnectorPublic {
  status: RailwayConnectorStatus;
  connectedAt: string;
  /** Public URL of the deployed Railway service the app calls. */
  serviceUrl: string;
  accountHint: string;
}

/** Encrypted Railway API token for a project. */
export interface ProjectRailwayConnector {
  public: RailwayConnectorPublic;
  apiTokenEnc: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  status: ProjectStatus;
  vibe: Vibe | null;
  thumbnailHue: number; // for the phone-preview placeholder gradient
  interview: InterviewTurn[];
  /** Kimi/rule-picked 0–2 questions from the curated pool (after idea). */
  interviewPlan?: import("@/lib/interviewQuestionPool").PoolQuestionId[] | null;
  /** Consumed on first fetch for `stepId` — avoids a second LLM round-trip after landing. */
  interviewStepPrefetch?: InterviewStepPrefetch | null;
  masterPrompt: MasterBuildPrompt | null;
  launch: LaunchAssets;
  legal: LegalDocs;
  /** Chosen generation target (set after the interview). null = not chosen yet. */
  target: BuildTarget | null;
  /** Private GitHub repo backing this app (invisible version control). Mock URL
   *  in dev. Maps user_id → app_id → github_repo_url per the phase spec. */
  githubRepoUrl: string | null;
  /** Generated RN/Expo screen model — web preview + future codegen source of truth. */
  expoAppModel: import("@/lib/expoApp/types").ExpoAppModel | null;
  /** Secret token for Expo Go shell to fetch expoAppModel (no session cookie). */
  expoPreviewToken?: string | null;
  /** Launch checklist progress — discussed items & decisions. */
  readinessState?: ProjectReadinessState | null;
  /** Brainstorm chat history + summary (Build agent reads this). */
  brainstormState?: ProjectBrainstormState | null;
  /** Linked Supabase project — keys stored encrypted server-side. */
  supabaseConnector?: ProjectSupabaseConnector | null;
  /** Linked RevenueCat project — keys + webhook sync to Supabase. */
  revenueCatConnector?: ProjectRevenueCatConnector | null;
  /** Linked Railway project — custom API / worker hosting. */
  railwayConnector?: ProjectRailwayConnector | null;
  /** Guest-session AI spend (merged to user on claim). */
  aiUsageUsd?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Short-lived handoff token: minted on the web when the user opens an app in the
 * Builder, exchanged once by the Builder for the app context. Kills the manual
 * project-ID copy/paste. Tied to a user + project.
 */
export interface HandoffToken {
  token: string;
  userId: string;
  projectId: string;
  target: BuildTarget | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface CachedBuild {
  id: string;
  userId: string;
  category: string;
  features: string[];
  vibe: Vibe;
  colors: string;
  codeRef: string;
  shared: boolean;
  createdAt: string;
}
