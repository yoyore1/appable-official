import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  clearWorkspaceNodeModules,
  diagnoseCommandFailure,
  repairWorkspace,
  summarizeCommandFailure,
  verifyRuntimePackages,
  writeHealthLog,
} from "./workspaceHealth";
import { workspaceRootFor } from "./workspace";

type DepsGlobal = typeof globalThis & {
  __appableWsInstall?: Map<string, Promise<boolean>>;
  __appableWsInstallErr?: Map<string, string>;
};

const g = globalThis as DepsGlobal;
const installJobs = (g.__appableWsInstall ??= new Map());
const installErrors = (g.__appableWsInstallErr ??= new Map());

const INSTALL_STRATEGIES: string[][] = [
  ["install", "--no-audit", "--no-fund"],
  ["install", "--no-audit", "--no-fund", "--legacy-peer-deps"],
  ["ci", "--no-audit", "--no-fund", "--legacy-peer-deps"],
];

function stampPath(projectId: string): string {
  return path.join(workspaceRootFor(projectId), ".appable", "deps-stamp.json");
}

function workspaceReady(projectId: string): boolean {
  return fs.existsSync(path.join(workspaceRootFor(projectId), "package.json"));
}

function packageFingerprint(projectId: string): string | null {
  try {
    const raw = fs.readFileSync(
      path.join(workspaceRootFor(projectId), "package.json"),
      "utf8"
    );
    return createHash("sha256").update(raw).digest("hex").slice(0, 24);
  } catch {
    return null;
  }
}

function stampMatches(projectId: string): boolean {
  if (!verifyRuntimePackages(projectId)) return false;
  const fp = packageFingerprint(projectId);
  if (!fp) return false;
  try {
    const stamp = JSON.parse(fs.readFileSync(stampPath(projectId), "utf8")) as {
      fingerprint?: string;
    };
    return stamp.fingerprint === fp;
  } catch {
    return false;
  }
}

function writeStamp(projectId: string): void {
  const fp = packageFingerprint(projectId);
  if (!fp) return;
  const dir = path.dirname(stampPath(projectId));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    stampPath(projectId),
    JSON.stringify({ fingerprint: fp, installedAt: new Date().toISOString() }),
    "utf8"
  );
}

/** Call when package.json changes so the next bootstrap re-runs npm install. */
export function markWorkspaceDependenciesStale(projectId: string): void {
  try {
    fs.unlinkSync(stampPath(projectId));
  } catch {
    /* no stamp yet */
  }
}

function npmRun(cwd: string, args: string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    let output = "";
    const child = spawn("npm", args, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "1" },
    });
    child.stdout?.on("data", (c) => {
      output = (output + c.toString()).slice(-12_000);
    });
    child.stderr?.on("data", (c) => {
      output = (output + c.toString()).slice(-12_000);
    });
    child.on("error", (e) => resolve({ ok: false, output: e.message }));
    child.on("exit", (code) => resolve({ ok: code === 0, output }));
  });
}

async function installWithSelfHeal(projectId: string): Promise<boolean> {
  const root = workspaceRootFor(projectId);
  let lastOutput = "";

  for (let round = 0; round < 2; round++) {
    const { repaired, needsReinstall } = repairWorkspace(projectId);
    if (repaired.length) {
      writeHealthLog(projectId, {
        action: "repair_package_json",
        ok: true,
        detail: repaired.join(", "),
      });
      if (needsReinstall) markWorkspaceDependenciesStale(projectId);
    }

    for (let i = 0; i < INSTALL_STRATEGIES.length; i++) {
      const args = INSTALL_STRATEGIES[i]!;
      const label = `npm ${args.join(" ")}`;
      const result = await npmRun(root, args);
      lastOutput = result.output;

      if (result.ok && verifyRuntimePackages(projectId)) {
        writeStamp(projectId);
        writeHealthLog(projectId, { action: label, ok: true });
        return true;
      }

      const hint = diagnoseCommandFailure(result.output);
      writeHealthLog(projectId, {
        action: label,
        ok: false,
        detail: hint?.hint ?? summarizeCommandFailure(result.output, "install failed"),
      });

      if (hint?.repair) {
        repairWorkspace(projectId);
      }
    }

    if (round === 0) {
      clearWorkspaceNodeModules(projectId);
      markWorkspaceDependenciesStale(projectId);
      writeHealthLog(projectId, {
        action: "clear_node_modules",
        ok: true,
        detail: "Retrying clean install after failed strategies.",
      });
    }
  }

  installErrors.set(
    projectId,
    summarizeCommandFailure(
      lastOutput,
      "Dependency install failed after automatic repair attempts."
    )
  );
  return false;
}

export function lastDependencyInstallError(projectId: string): string | undefined {
  return installErrors.get(projectId);
}

/**
 * Auto npm install with self-diagnosis + repair.
 * Deduped per project; verifies required runtime packages on disk.
 */
export async function ensureWorkspaceDependencies(
  projectId: string
): Promise<boolean> {
  if (!workspaceReady(projectId)) return false;

  repairWorkspace(projectId);

  if (stampMatches(projectId)) {
    installErrors.delete(projectId);
    return true;
  }

  let job = installJobs.get(projectId);
  if (!job) {
    job = installWithSelfHeal(projectId)
      .then((ok) => {
        if (ok) installErrors.delete(projectId);
        return ok;
      })
      .finally(() => {
        installJobs.delete(projectId);
      });
    installJobs.set(projectId, job);
  }
  return job;
}

export function isInstallingDependencies(projectId: string): boolean {
  return installJobs.has(projectId);
}
