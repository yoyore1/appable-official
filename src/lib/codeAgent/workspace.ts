import { mkdir, readFile, writeFile, copyFile, stat, readdir } from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { coerceExpoAppModel } from "@/lib/expoApp/coerceModel";
import type { ExpoAppModel } from "@/lib/expoApp/types";
import type { MasterBuildPrompt } from "@/lib/types";
import { codeAgentConfig } from "@/lib/config";
import { scaffoldExpoApp } from "./scaffoldExpoApp";

const execFileAsync = promisify(execFile);

/** Platform files mirrored into each project workspace (editable by the code agent). */
const MIRROR_PATHS = [
  "src/components/ExpoLivePreview.tsx",
  "src/lib/expoApp/types.ts",
  "src/lib/expoApp/tweakPaths.ts",
  "src/lib/expoApp/previewCopyFields.ts",
  "src/lib/expoApp/buildOps.ts",
  "src/lib/expoApp/previewBuildState.ts",
] as const;

const MODEL_REL = "model/expoAppModel.json";
const META_REL = "appable.json";

export function workspaceRootFor(projectId: string): string {
  return path.join(codeAgentConfig.workspaceRoot, projectId);
}

export function resolveWorkspacePath(projectId: string, rel: string): string {
  const root = workspaceRootFor(projectId);
  const normalized = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
  const abs = path.join(root, normalized);
  if (!abs.startsWith(root)) {
    throw new Error("Path escapes workspace");
  }
  return abs;
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function gitInit(root: string): Promise<void> {
  if (await exists(path.join(root, ".git"))) return;
  await execFileAsync("git", ["init"], { cwd: root });
  await execFileAsync("git", ["config", "user.email", "build@appable.app"], { cwd: root });
  await execFileAsync("git", ["config", "user.name", "Appable Build"], { cwd: root });
}

async function copyMirrorFile(repoRoot: string, workspaceRoot: string, rel: string): Promise<void> {
  const src = path.join(repoRoot, rel);
  const dest = path.join(workspaceRoot, rel);
  await mkdir(path.dirname(dest), { recursive: true });
  if (!(await exists(src))) return;
  await copyFile(src, dest);
}

export async function ensureProjectWorkspace(input: {
  projectId: string;
  model: ExpoAppModel;
  appName: string;
  userId: string;
  repoRoot?: string;
  masterPrompt?: MasterBuildPrompt | null;
  scaffoldApp?: boolean;
}): Promise<string> {
  const root = workspaceRootFor(input.projectId);
  const repoRoot = input.repoRoot ?? process.cwd();
  await mkdir(root, { recursive: true });

  for (const rel of MIRROR_PATHS) {
    await copyMirrorFile(repoRoot, root, rel);
  }

  await mkdir(path.join(root, "model"), { recursive: true });
  await writeFile(
    path.join(root, MODEL_REL),
    JSON.stringify(input.model, null, 2),
    "utf8"
  );

  await writeFile(
    path.join(root, META_REL),
    JSON.stringify(
      {
        projectId: input.projectId,
        appName: input.appName,
        userId: input.userId,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );

  if (input.scaffoldApp !== false && input.masterPrompt) {
    await scaffoldExpoApp(root, input.model, input.masterPrompt);
  }

  await gitInit(root);
  return root;
}

/** Persist DB model into workspace JSON (keeps web preview + native app in sync). */
export async function syncModelToWorkspace(
  projectId: string,
  model: ExpoAppModel
): Promise<void> {
  const p = path.join(workspaceRootFor(projectId), MODEL_REL);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(model, null, 2), "utf8");
}

/** Throws if the Expo Router scaffold did not land (initial build must not be preview-only). */
export async function assertWorkspaceScaffolded(projectId: string): Promise<void> {
  const layout = path.join(workspaceRootFor(projectId), "app", "(tabs)", "_layout.tsx");
  if (!(await exists(layout))) {
    throw new Error("WORKSPACE_SCAFFOLD_FAILED");
  }
}

export async function loadModelFromWorkspace(projectId: string): Promise<ExpoAppModel | null> {
  const p = path.join(workspaceRootFor(projectId), MODEL_REL);
  if (!(await exists(p))) return null;
  const raw = await readFile(p, "utf8");
  return coerceExpoAppModel(JSON.parse(raw));
}

/** All text files in workspace for GitHub commit (relative paths). */
export async function listWorkspaceFiles(projectId: string): Promise<string[]> {
  const root = workspaceRootFor(projectId);
  const out: string[] = [];

  async function walk(dir: string, prefix = ""): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === ".git" || ent.name === "node_modules") continue;
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(abs, rel);
      else if (/\.(tsx?|json|md)$/i.test(ent.name)) out.push(rel.replace(/\\/g, "/"));
    }
  }

  await walk(root);
  return out;
}

export async function readWorkspaceFile(
  projectId: string,
  rel: string
): Promise<string> {
  return readFile(resolveWorkspacePath(projectId, rel), "utf8");
}

export async function writeWorkspaceFile(
  projectId: string,
  rel: string,
  content: string
): Promise<void> {
  const abs = resolveWorkspacePath(projectId, rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content, "utf8");
  const normalized = rel.replace(/\\/g, "/");
  if (normalized === "package.json" || normalized.endsWith("/package.json")) {
    const { markWorkspaceDependenciesStale } = await import("./workspaceDeps");
    markWorkspaceDependenciesStale(projectId);
  }
}
