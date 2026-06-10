import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { codeAgentConfig } from "@/lib/config";
import {
  ensureWorkspaceDependencies,
  lastDependencyInstallError,
  markWorkspaceDependenciesStale,
} from "./workspaceDeps";
import {
  diagnoseCommandFailure,
  repairWorkspace,
  summarizeCommandFailure,
  writeHealthLog,
} from "./workspaceHealth";
import { db } from "@/lib/db";
import { ensureWorkspaceRouterSyncFromDisk } from "./ensureWorkspaceRouter";
import { expoWebBasePath } from "./previewBaseShim";
import { workspaceRootFor } from "./workspace";

export type WebPreviewPhase =
  | "idle"
  | "installing"
  | "exporting"
  | "ready"
  | "error";

export interface WebPreviewStatus {
  phase: WebPreviewPhase;
  builtAt: string | null;
  error?: string;
  /** True once a dist/ folder exists on disk (servable). */
  hasDist: boolean;
}

type WebGlobal = typeof globalThis & {
  __appableWebExport?: Map<string, { phase: WebPreviewPhase; error?: string }>;
  __appableWebExportJob?: Map<string, Promise<boolean>>;
};

const g = globalThis as WebGlobal;
const state = (g.__appableWebExport ??= new Map());
const exportJobs = (g.__appableWebExportJob ??= new Map());

const MAX_EXPORT_ATTEMPTS = 3;

function distDir(projectId: string): string {
  return path.join(workspaceRootFor(projectId), "dist");
}

function statusFile(projectId: string): string {
  return path.join(workspaceRootFor(projectId), ".appable-web.json");
}

export function hasDist(projectId: string): boolean {
  try {
    return fs.existsSync(path.join(distDir(projectId), "index.html"));
  } catch {
    return false;
  }
}

function readBuiltAt(projectId: string): string | null {
  try {
    const raw = fs.readFileSync(statusFile(projectId), "utf8");
    return (JSON.parse(raw) as { builtAt?: string }).builtAt ?? null;
  } catch {
    return null;
  }
}

function writeBuiltAt(projectId: string): void {
  try {
    fs.writeFileSync(
      statusFile(projectId),
      JSON.stringify({ builtAt: new Date().toISOString() }, null, 2)
    );
  } catch {
    /* best effort */
  }
}

export function webPreviewStatus(projectId: string): WebPreviewStatus {
  const mem = state.get(projectId);
  const dist = hasDist(projectId);
  const builtAt = readBuiltAt(projectId);
  let phase: WebPreviewPhase = mem?.phase ?? (dist ? "ready" : "idle");
  if (phase === "ready" && !dist) phase = "idle";
  return { phase, builtAt, error: mem?.error, hasDist: dist };
}

export function workspaceWebDistFile(
  projectId: string,
  relParts: string[]
): string | null {
  const root = distDir(projectId);
  const rel = relParts.join("/") || "index.html";
  const normalized = path
    .normalize(rel)
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const abs = path.join(root, normalized);
  if (!abs.startsWith(root)) return null;
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  const index = path.join(root, "index.html");
  return fs.existsSync(index) ? index : null;
}

function run(
  cmd: string,
  args: string[],
  cwd: string,
  projectId?: string
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    let output = "";
    const baseUrl = projectId ? expoWebBasePath(projectId) : "";
    const child = spawn(cmd, args, {
      cwd,
      shell: true,
      env: {
        ...process.env,
        CI: "1",
        ...(baseUrl
          ? {
              EXPO_PUBLIC_BASE_URL: baseUrl,
              EXPO_BASE_URL: baseUrl,
            }
          : {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (c) => (output += c.toString()));
    child.stderr?.on("data", (c) => (output += c.toString()));
    child.on("error", (e) => resolve({ ok: false, output: e.message }));
    child.on("exit", (code) =>
      resolve({ ok: code === 0, output: output.slice(-6000) })
    );
  });
}

async function exportWebOnce(projectId: string): Promise<boolean> {
  const root = workspaceRootFor(projectId);
  state.set(projectId, { phase: "installing" });

  const project = await db.getProject(projectId);
  if (project?.masterPrompt) {
    const regen = await ensureWorkspaceRouterSyncFromDisk(
      projectId,
      project.masterPrompt
    );
    if (regen) markWorkspaceDependenciesStale(projectId);
  }

  const depsOk = await ensureWorkspaceDependencies(projectId);
  if (!depsOk) {
    state.set(projectId, {
      phase: "error",
      error:
        lastDependencyInstallError(projectId) ??
        "Dependency install failed — auto-repair will retry.",
    });
    return false;
  }

  state.set(projectId, { phase: "exporting" });
  const exported = await run(
    "npx",
    ["expo", "export", "--platform", "web", "--output-dir", "dist"],
    root,
    projectId
  );

  if (exported.ok && hasDist(projectId)) {
    writeBuiltAt(projectId);
    state.set(projectId, { phase: "ready" });
    writeHealthLog(projectId, { action: "expo_export_web", ok: true });
    return true;
  }

  const hint = diagnoseCommandFailure(exported.output);
  const errMsg = summarizeCommandFailure(
    exported.output,
    "Web compile failed."
  );
  state.set(projectId, { phase: "error", error: errMsg });
  writeHealthLog(projectId, {
    action: "expo_export_web",
    ok: false,
    detail: hint?.hint ?? errMsg,
  });

  if (hint?.repair) {
    const { needsReinstall } = repairWorkspace(projectId);
    if (needsReinstall) markWorkspaceDependenciesStale(projectId);
  }
  return false;
}

/** Self-healing web export — retries after automatic repairs. */
export async function runWebExportWithRepair(projectId: string): Promise<boolean> {
  if (hasDist(projectId)) {
    state.set(projectId, { phase: "ready" });
    return true;
  }

  let existing = exportJobs.get(projectId);
  if (!existing) {
    existing = (async () => {
      for (let attempt = 0; attempt < MAX_EXPORT_ATTEMPTS; attempt++) {
        const ok = await exportWebOnce(projectId);
        if (ok) return true;
        if (attempt < MAX_EXPORT_ATTEMPTS - 1) {
          repairWorkspace(projectId);
          markWorkspaceDependenciesStale(projectId);
        }
      }
      return false;
    })().finally(() => {
      exportJobs.delete(projectId);
    });
    exportJobs.set(projectId, existing);
  }
  return existing;
}

/** Kick off a background Expo web export of the project workspace. */
export function triggerWorkspaceWebExport(projectId: string): void {
  const mem = state.get(projectId);
  if (mem?.phase === "installing" || mem?.phase === "exporting") return;
  if (exportJobs.has(projectId)) return;
  if (mem?.phase === "error") state.delete(projectId);
  void runWebExportWithRepair(projectId);
}

/** Block until web preview is ready (used before user opens build room). */
export async function awaitWebPreviewReady(
  projectId: string,
  timeoutMs = 360_000
): Promise<boolean> {
  if (hasDist(projectId)) return true;

  void runWebExportWithRepair(projectId);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (hasDist(projectId)) return true;
    const mem = state.get(projectId);
    if (mem?.phase === "error") {
      void runWebExportWithRepair(projectId);
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  return hasDist(projectId);
}

export { codeAgentConfig };
