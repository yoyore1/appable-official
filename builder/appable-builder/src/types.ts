export type Vibe = "Cinematic" | "Minimal" | "Bold" | "Soft" | "Luxury";

/** The handoff artifact fetched from the platform by project ID. */
export interface MasterBuildPrompt {
  appName: string;
  description: string;
  audience: string;
  features: string[];
  vibe: Vibe;
  colors: string;
  screens: string[];
}

export type BuildMode = "base" | "full";

export interface GeneratedFile {
  /** Path relative to the generated project root. */
  path: string;
  contents: string;
}

export interface BuildPlan {
  appName: string;
  bundleId: string;
  mode: BuildMode;
  files: GeneratedFile[];
}

export interface CompileIssue {
  file: string;
  line?: number;
  message: string;
}

export interface UsageReport {
  build: number;
  review: number;
}

export interface BuildResult {
  appName: string;
  bundleId: string;
  mode: BuildMode;
  projectDir: string;
  fileCount: number;
  rounds: number;
  compiled: boolean;
  usage: UsageReport;
  shipPath: "mac" | "windows";
  codemagicYaml?: string;
}

/** Reference build returned by find_similar_builds for context injection. */
export interface SimilarBuild {
  id: string;
  category: string;
  features: string[];
  vibe: Vibe;
  colors: string;
  codeRef: string;
  score: number;
}
