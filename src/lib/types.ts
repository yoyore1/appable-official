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

export interface Project {
  id: string;
  userId: string;
  name: string;
  status: ProjectStatus;
  vibe: Vibe | null;
  thumbnailHue: number; // for the phone-preview placeholder gradient
  interview: InterviewTurn[];
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
