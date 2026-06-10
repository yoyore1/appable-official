import type { PreviewBuildState } from "@/lib/expoApp/previewBuildState";
import type { ExpoAppModel } from "@/lib/expoApp/types";
import type { BrainstormTurn, InterviewTurn, MasterBuildPrompt } from "@/lib/types";

export type CodeAgentToolName =
  | "read_file"
  | "write_file"
  | "list_dir"
  | "grep"
  | "run_cmd";

export type CodeAgentToolCall = {
  tool: CodeAgentToolName;
  path?: string;
  content?: string;
  pattern?: string;
  command?: string;
};

export type CodeAgentStep = {
  tool: CodeAgentToolName;
  ok: boolean;
  summary: string;
};

export type RunProjectCodeAgentInput = {
  projectId: string;
  model: ExpoAppModel;
  mp: MasterBuildPrompt;
  message: string;
  previewState?: PreviewBuildState;
  buildHistory?: BrainstormTurn[];
  brainstormHistory?: BrainstormTurn[];
  brainstormContext?: string;
  interview?: InterviewTurn[];
  githubRepoUrl?: string | null;
  userId?: string;
  appName?: string;
};

export type RunProjectCodeAgentResult =
  | { kind: "applied"; model: ExpoAppModel; reply: string; committed: boolean; steps: CodeAgentStep[] }
  | { kind: "clarify"; reply: string }
  | null;
