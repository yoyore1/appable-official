import {
  awaitWebPreviewReady,
  triggerWorkspaceWebExport,
  webPreviewStatus,
} from "./webExport";
import {
  ensureWorkspaceDependencies,
  isInstallingDependencies,
  lastDependencyInstallError,
  markWorkspaceDependenciesStale,
} from "./workspaceDeps";
import { db } from "@/lib/db";
import { ensureWorkspaceRouterSyncFromDisk } from "./ensureWorkspaceRouter";
import {
  diagnoseWorkspace,
  readHealthLog,
  repairWorkspace,
  type WorkspaceDiagnosis,
} from "./workspaceHealth";
import { workspaceDevServerSnapshot } from "@/lib/expoWorkspaceDevServer";
import {
  bumpLiveWebPreview,
  ensureWebDevServer,
  stopWebDevServer,
  webDevServerSnapshot,
} from "./webDevServer";
import fs from "node:fs";
import path from "node:path";
import { workspaceRootFor } from "./workspace";

function workspaceReady(projectId: string): boolean {
  return fs.existsSync(path.join(workspaceRootFor(projectId), "package.json"));
}

/**
 * Auto-bootstrap everything — no user action, ever.
 * Self-diagnoses + repairs before install and compile.
 */
export function bootstrapWorkspaceRuntime(projectId: string): void {
  if (!workspaceReady(projectId)) return;
  void runBootstrap(projectId, { blocking: false });
}

/**
 * Full bootstrap before user lands on build room —
 * repair → install → web compile (waits) → Metro.
 */
export async function bootstrapWorkspaceRuntimeBlocking(
  projectId: string
): Promise<void> {
  if (!workspaceReady(projectId)) return;
  await runBootstrap(projectId, { blocking: true });
}

async function runBootstrap(
  projectId: string,
  opts: { blocking: boolean }
): Promise<void> {
  const { repaired } = repairWorkspace(projectId);
  if (repaired.length) {
    markWorkspaceDependenciesStale(projectId);
  }

  const project = await db.getProject(projectId);
  if (project?.masterPrompt) {
    const routerRegen = await ensureWorkspaceRouterSyncFromDisk(
      projectId,
      project.masterPrompt
    );
    if (routerRegen) markWorkspaceDependenciesStale(projectId);
  }

  await ensureWorkspaceDependencies(projectId);

  // Live web dev server (Metro Fast Refresh) — the fast path for the iframe.
  ensureWebDevServer(projectId);

  // Static export stays as a first-paint fallback while Metro warms up, and for publish.
  if (opts.blocking) {
    await awaitWebPreviewReady(projectId);
  } else {
    triggerWorkspaceWebExport(projectId);
  }

  // Expo Go tunnel (native phone) is started on-demand via /api/projects/:id/expo-go,
  // so it no longer runs here — avoids two Metro instances on one workspace.
}

export function workspaceRuntimeStatus(projectId: string): {
  installing: boolean;
  depsError?: string;
  health: WorkspaceDiagnosis;
  healthLog: ReturnType<typeof readHealthLog>;
  web: ReturnType<typeof webPreviewStatus>;
  liveWeb: ReturnType<typeof webDevServerSnapshot>;
  expoGo: ReturnType<typeof workspaceDevServerSnapshot>;
} {
  return {
    installing: isInstallingDependencies(projectId),
    depsError: lastDependencyInstallError(projectId),
    health: diagnoseWorkspace(projectId),
    healthLog: readHealthLog(projectId),
    web: webPreviewStatus(projectId),
    liveWeb: webDevServerSnapshot(projectId),
    expoGo: workspaceDevServerSnapshot(projectId),
  };
}

/**
 * After a model/code edit — sync routes if needed and kick off web compile in the background.
 * Does not block on export (preview polls until ready).
 */
export async function refreshWorkspacePreview(projectId: string): Promise<void> {
  if (!workspaceReady(projectId)) return;

  const project = await db.getProject(projectId);
  if (project?.masterPrompt) {
    await ensureWorkspaceRouterSyncFromDisk(projectId, project.masterPrompt);
  }

  // If the live web dev server is up, the edit already landed in the workspace
  // JSON/.tsx that Metro serves. Bump the edit counter so the iframe reloads the
  // already-built bundle (near-instant) — no slow re-export needed.
  const live = webDevServerSnapshot(projectId);
  if (live.phase === "ready" && live.publicUrl) {
    ensureWebDevServer(projectId);
    bumpLiveWebPreview(projectId);
    return;
  }

  ensureWebDevServer(projectId);
  triggerWorkspaceWebExport(projectId);
}

/** Force a fresh self-healing install + web compile (Rebuild app button). */
export function rebuildWorkspaceRuntime(projectId: string): void {
  if (!workspaceReady(projectId)) return;
  stopWebDevServer(projectId);
  repairWorkspace(projectId);
  markWorkspaceDependenciesStale(projectId);
  bootstrapWorkspaceRuntime(projectId);
}
