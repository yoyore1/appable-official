/**
 * Coding-agent client (Kimi K2.6 via DeepInfra, OpenAI-compatible). When no
 * BUILD_MODEL_* keys are set, it falls back to the deterministic SwiftUI
 * generator so the whole loop runs offline. Reference builds from the platform
 * cache are injected into the system prompt so the agent adapts rather than
 * starting from scratch.
 */
import { buildModel, integrations } from "./config.js";
import { generateSwiftUIProject } from "./swiftgen.js";
import type {
  BuildMode,
  CompileIssue,
  GeneratedFile,
  MasterBuildPrompt,
  SimilarBuild,
} from "./types.js";

/** Rough token estimate used for budget/usage accounting. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function complete(messages: ChatMessage[], maxTokens: number): Promise<string> {
  const res = await fetch(`${buildModel.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${buildModel.key}`,
    },
    body: JSON.stringify({
      model: buildModel.name,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`build model ${res.status}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data?.choices?.[0]?.message?.content ?? "";
}

function referenceContext(refs: SimilarBuild[]): string {
  if (refs.length === 0) return "";
  return (
    "\nReference structures from similar past builds (adapt, don't copy verbatim):\n" +
    refs
      .map((r) => `- ${r.category} / ${r.vibe}: features ${r.features.join(", ")} (ref ${r.codeRef})`)
      .join("\n")
  );
}

export async function generateProject(
  prompt: MasterBuildPrompt,
  mode: BuildMode,
  refs: SimilarBuild[]
): Promise<GeneratedFile[]> {
  if (!integrations.buildModel) {
    // Mock agent: deterministic, real SwiftUI.
    return generateSwiftUIProject(prompt, mode);
  }

  const system =
    "You are an expert iOS engineer. Generate a complete native SwiftUI app as " +
    "an XcodeGen project. Respond with STRICT JSON: { \"files\": [ { \"path\": " +
    "string, \"contents\": string } ] }. Include project.yml, Resources/Info.plist, " +
    "an @main App, themed SwiftUI views for every screen, and mock data. " +
    (mode === "full"
      ? "This is a FULL build: also wire Supabase auth/db/storage, a RevenueCat paywall, and push notifications."
      : "This is a BASE build: UI only with mock data.") +
    referenceContext(refs);

  const user = `Master build prompt:\n${JSON.stringify(prompt, null, 2)}`;
  const raw = await complete(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    8000
  );
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.files) && parsed.files.length > 0) {
      return parsed.files as GeneratedFile[];
    }
  } catch {
    /* fall through */
  }
  // If the model returned something unusable, fall back to the generator.
  return generateSwiftUIProject(prompt, mode);
}

export async function proposeFixes(
  files: GeneratedFile[],
  issues: CompileIssue[]
): Promise<GeneratedFile[]> {
  if (!integrations.buildModel) {
    // Deterministic mock fixer: apply trivial known repairs.
    return mockFix(files, issues);
  }
  const system =
    "You are fixing Swift compile errors. Given the files and the errors, return " +
    'STRICT JSON { "files": [ { "path", "contents" } ] } containing ONLY the ' +
    "files you changed, fully rewritten.";
  const user = JSON.stringify({ issues, files: files.map((f) => ({ path: f.path, contents: f.contents })) });
  const raw = await complete(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    6000
  );
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.files)) return parsed.files as GeneratedFile[];
  } catch {
    /* ignore */
  }
  return [];
}

/** A tiny deterministic "fixer" for the mock compiler's simulated issues. */
function mockFix(files: GeneratedFile[], issues: CompileIssue[]): GeneratedFile[] {
  const changed: GeneratedFile[] = [];
  for (const issue of issues) {
    const f = files.find((x) => x.path === issue.file);
    if (!f) continue;
    let contents = f.contents;
    if (/missing import SwiftUI/i.test(issue.message) && !contents.startsWith("import SwiftUI")) {
      contents = "import SwiftUI\n" + contents;
    }
    if (contents !== f.contents) changed.push({ path: f.path, contents });
  }
  return changed;
}
