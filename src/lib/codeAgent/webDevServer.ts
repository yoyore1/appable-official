import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  ensureWorkspaceDependencies,
  lastDependencyInstallError,
} from "./workspaceDeps";
import { workspaceRootFor } from "./workspace";

/**
 * Live web dev server (Phase 0).
 *
 * Runs `expo start --web` on the Appable server. Browsers never hit localhost
 * directly — they load `/api/expo-live/{projectId}/`, which the custom server
 * proxies to Metro (HTTP + WebSocket for Fast Refresh).
 */

export type WebDevPhase = "idle" | "starting" | "ready" | "error";

const LIVE_PATH_RE = /^\/api\/expo-live\/([^/]+)/;

interface WebDevState {
  projectId: string;
  process?: ChildProcess;
  phase: WebDevPhase;
  port: number | null;
  error?: string;
  startedAt: number;
  /** Bumped whenever an edit lands — the iframe reloads the (already-built) bundle. */
  editedAt: number;
}

type WebDevGlobal = typeof globalThis & {
  __appableWebDev?: WebDevState | null;
  __appableWebDevStarting?: Map<string, Promise<void>>;
};

const g = globalThis as WebDevGlobal;
const starting = (g.__appableWebDevStarting ??= new Map());

export interface WebDevSnapshot {
  phase: WebDevPhase;
  /** Same-origin path the iframe should load — safe for remote users. */
  publicUrl: string | null;
  port: number | null;
  /** Edit counter — when this changes the client reloads the live preview. */
  editedAt: number;
  error?: string;
}

/** Public iframe/proxy path (no trailing slash). */
export function liveWebPreviewPath(projectId: string): string {
  return `/api/expo-live/${projectId}`;
}

export function parseLiveWebProjectId(pathname: string): string | null {
  const hit = pathname.match(LIVE_PATH_RE);
  return hit?.[1] ?? null;
}

export function webDevServerSnapshot(projectId: string): WebDevSnapshot {
  const s = g.__appableWebDev;
  if (!s || s.projectId !== projectId) {
    return { phase: "idle", publicUrl: null, port: null, editedAt: 0 };
  }
  return {
    phase: s.phase,
    publicUrl:
      s.phase === "ready" && s.port
        ? liveWebPreviewPath(projectId)
        : null,
    port: s.port,
    editedAt: s.editedAt,
    error: s.error,
  };
}

/** Signal that an edit landed — the live preview reloads its built bundle. */
export function bumpLiveWebPreview(projectId: string): void {
  const s = g.__appableWebDev;
  if (s && s.projectId === projectId) s.editedAt = Date.now();
}

function captureWebPort(state: WebDevState, chunk: Buffer | string): void {
  const text = chunk.toString();
  const match = text.match(/https?:\/\/(?:localhost|127\.0\.0\.1):(\d+)/);
  if (match?.[1]) {
    state.port = parseInt(match[1], 10);
    if (state.phase !== "error") state.phase = "ready";
  }
  if (/error|cannot|failed to start/i.test(text) && !state.port) {
    state.error = text.slice(0, 300);
  }
}

function killCurrent(): void {
  const s = g.__appableWebDev;
  if (s?.process && !s.process.killed) {
    try {
      s.process.kill();
    } catch {
      /* ignore */
    }
  }
  g.__appableWebDev = null;
}

function isAlive(projectId: string): boolean {
  const s = g.__appableWebDev;
  return Boolean(
    s &&
      s.projectId === projectId &&
      s.process &&
      !s.process.killed &&
      s.phase !== "error"
  );
}

/**
 * Ensure a live web dev server is running for this project.
 * Non-blocking past dependency install — the iframe polls the snapshot for the URL.
 */
export function ensureWebDevServer(projectId: string): void {
  if (isAlive(projectId)) return;
  if (starting.has(projectId)) return;

  const job = startWebDevServer(projectId).finally(() => {
    starting.delete(projectId);
  });
  starting.set(projectId, job);
}

async function startWebDevServer(projectId: string): Promise<void> {
  const root = workspaceRootFor(projectId);
  if (!fs.existsSync(path.join(root, "package.json"))) return;

  const existing = g.__appableWebDev;
  if (existing && existing.projectId !== projectId) killCurrent();

  const publicBase = liveWebPreviewPath(projectId);

  const state: WebDevState = {
    projectId,
    phase: "starting",
    port: null,
    startedAt: Date.now(),
    editedAt: 0,
  };
  g.__appableWebDev = state;

  const depsOk = await ensureWorkspaceDependencies(projectId);
  if (!depsOk) {
    state.phase = "error";
    state.error =
      lastDependencyInstallError(projectId) ??
      "Dependency install failed — tap Rebuild to retry.";
    return;
  }

  try {
    const child = spawn(
      "npx",
      ["expo", "start", "--web"],
      {
        cwd: root,
        env: {
          ...process.env,
          CI: "1",
          BROWSER: "none",
          EXPO_NO_TELEMETRY: "1",
          EXPO_PUBLIC_BASE_URL: publicBase,
          EXPO_BASE_URL: publicBase,
        },
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    state.process = child;
    child.stdout?.on("data", (c) => captureWebPort(state, c));
    child.stderr?.on("data", (c) => captureWebPort(state, c));
    child.on("error", (err) => {
      state.phase = "error";
      state.error = err.message;
    });
    child.on("exit", (code) => {
      if (state.phase !== "ready") {
        state.phase = "error";
        state.error = `Web dev server stopped (${code ?? "unknown"}).`;
      }
      if (g.__appableWebDev === state) g.__appableWebDev = null;
    });
  } catch (e) {
    state.phase = "error";
    state.error = e instanceof Error ? e.message : "Could not start web dev server.";
  }
}

/** Stop the live web dev server (used before a clean rebuild). */
export function stopWebDevServer(projectId: string): void {
  const s = g.__appableWebDev;
  if (s && s.projectId === projectId) killCurrent();
}
