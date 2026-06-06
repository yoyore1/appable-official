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
  createdAt: string;
}

export type ProjectStatus =
  | "interviewing"
  | "ready" // master prompt generated, ready for builder handoff
  | "building"
  | "live";

/** The structured handoff artifact the build engine fetches by project ID. */
export interface MasterBuildPrompt {
  appName: string;
  description: string;
  audience: string;
  features: string[];
  vibe: Vibe;
  colors: string;
  screens: string[];
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
  createdAt: string;
  updatedAt: string;
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
