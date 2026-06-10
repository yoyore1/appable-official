import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  ensureWorkspaceDependencies,
  lastDependencyInstallError,
} from "@/lib/codeAgent/workspaceDeps";
import { workspaceRootFor } from "@/lib/codeAgent/workspace";

export type WorkspaceDevStatus = "idle" | "starting" | "ready" | "error";

interface DevState {
  projectId: string;
  process?: ChildProcess;
  status: WorkspaceDevStatus;
  url: string | null;
  error?: string;
}

type DevGlobal = typeof globalThis & {
  __appableWsDev?: DevState | null;
};

const g = globalThis as DevGlobal;

function snapshotFor(projectId: string): {
  status: WorkspaceDevStatus;
  url: string | null;
  error?: string;
} {
  const s = g.__appableWsDev;
  if (!s || s.projectId !== projectId) {
    return { status: "idle", url: null };
  }
  return { status: s.status, url: s.url, error: s.error };
}

function captureExpUrl(state: DevState, chunk: Buffer | string) {
  const text = chunk.toString();
  const match = text.match(/exp:\/\/[^\s"'<>]+/);
  if (!match) return;
  state.url = match[0].replace(/[.,;]+$/, "");
  state.status = "ready";
}

function killCurrent() {
  const s = g.__appableWsDev;
  if (s?.process && !s.process.killed) {
    try {
      s.process.kill();
    } catch {
      /* ignore */
    }
  }
  g.__appableWsDev = null;
}

/** Start (or reuse) Metro + tunnel for a single project's real Expo workspace. */
export async function ensureWorkspaceDevServer(projectId: string): Promise<{
  status: WorkspaceDevStatus;
  url: string | null;
  error?: string;
}> {
  const existing = g.__appableWsDev;
  if (
    existing &&
    existing.projectId === projectId &&
    existing.process &&
    !existing.process.killed
  ) {
    return snapshotFor(projectId);
  }

  // Only one workspace Metro at a time — switch projects cleanly.
  if (existing && existing.projectId !== projectId) {
    killCurrent();
  }

  const root = workspaceRootFor(projectId);
  if (!fs.existsSync(path.join(root, "package.json"))) {
    return { status: "error", url: null, error: "Workspace not built yet." };
  }

  const state: DevState = { projectId, status: "starting", url: null };
  g.__appableWsDev = state;

  const depsOk = await ensureWorkspaceDependencies(projectId);
  if (!depsOk) {
    state.status = "error";
    state.error =
      lastDependencyInstallError(projectId) ??
      "Dependency install failed — tap Rebuild to retry.";
    return snapshotFor(projectId);
  }

  try {
    const child = spawn("npx", ["expo", "start", "--tunnel"], {
      cwd: root,
      env: { ...process.env, CI: "1" },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    state.process = child;
    child.stdout?.on("data", (c) => captureExpUrl(state, c));
    child.stderr?.on("data", (c) => captureExpUrl(state, c));
    child.on("error", (err) => {
      state.status = "error";
      state.error = err.message;
    });
    child.on("exit", (code) => {
      if (state.status !== "ready") {
        state.status = "error";
        state.error = `Metro stopped (${code ?? "unknown"}).`;
      }
      if (g.__appableWsDev === state) g.__appableWsDev = null;
    });
  } catch (e) {
    state.status = "error";
    state.error = e instanceof Error ? e.message : "Could not start Metro.";
  }

  return snapshotFor(projectId);
}

export function workspaceDevServerSnapshot(projectId: string): {
  status: WorkspaceDevStatus;
  url: string | null;
  error?: string;
} {
  return snapshotFor(projectId);
}
