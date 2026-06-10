import { coerceExpoAppModel } from "@/lib/expoApp/coerceModel";
import fs from "node:fs";
import path from "node:path";
import { workspaceRouterOutOfSync } from "./workspaceRouterCheck";
import { workspaceRootFor } from "./workspace";

export type WorkspaceIssueCode =
  | "missing_package_json"
  | "corrupt_package_json"
  | "missing_web_deps"
  | "bloated_eas_cli"
  | "missing_node_modules"
  | "missing_runtime_pkg"
  | "missing_flow_routes";

export interface WorkspaceIssue {
  code: WorkspaceIssueCode;
  message: string;
  autoFix: string;
}

export interface WorkspaceDiagnosis {
  projectId: string;
  healthy: boolean;
  issues: WorkspaceIssue[];
  checkedAt: string;
}

/** Packages that must exist on disk after npm install for preview + Metro. */
export const REQUIRED_RUNTIME_PACKAGES: { name: string; path: string }[] = [
  { name: "expo", path: "node_modules/expo/package.json" },
  { name: "expo-router", path: "node_modules/expo-router/package.json" },
  { name: "react-native-web", path: "node_modules/react-native-web/package.json" },
  { name: "react-dom", path: "node_modules/react-dom/package.json" },
];

export const WEB_RUNTIME_DEPS: Record<string, string> = {
  "react-dom": "18.2.0",
  "react-native-web": "~0.19.10",
};

function healthLogPath(projectId: string): string {
  return path.join(workspaceRootFor(projectId), ".appable", "health.json");
}

function readPackageJson(projectId: string): Record<string, unknown> | null {
  const pkgPath = path.join(workspaceRootFor(projectId), "package.json");
  try {
    return JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function diagnoseWorkspace(projectId: string): WorkspaceDiagnosis {
  const issues: WorkspaceIssue[] = [];
  const root = workspaceRootFor(projectId);
  const pkgPath = path.join(root, "package.json");

  if (!fs.existsSync(pkgPath)) {
    issues.push({
      code: "missing_package_json",
      message: "Workspace has no package.json yet.",
      autoFix: "Re-run initial codegen scaffold.",
    });
    return {
      projectId,
      healthy: false,
      issues,
      checkedAt: new Date().toISOString(),
    };
  }

  const pkg = readPackageJson(projectId);
  if (!pkg) {
    issues.push({
      code: "corrupt_package_json",
      message: "package.json is unreadable.",
      autoFix: "Regenerate workspace package.json from scaffold.",
    });
  } else {
    const deps = (pkg.dependencies ?? {}) as Record<string, string>;
    for (const [name, version] of Object.entries(WEB_RUNTIME_DEPS)) {
      if (!deps[name]) {
        issues.push({
          code: "missing_web_deps",
          message: `Missing web dependency: ${name}`,
          autoFix: `Add ${name}@${version} to dependencies.`,
        });
      }
    }
    const dev = (pkg.devDependencies ?? {}) as Record<string, string>;
    if (dev["eas-cli"]) {
      issues.push({
        code: "bloated_eas_cli",
        message: "eas-cli in workspace slows installs and causes version conflicts.",
        autoFix: "Remove eas-cli from workspace (EAS uses npx).",
      });
    }
  }

  if (!fs.existsSync(path.join(root, "node_modules"))) {
    issues.push({
      code: "missing_node_modules",
      message: "Dependencies not installed yet.",
      autoFix: "Run npm install.",
    });
  } else {
    for (const req of REQUIRED_RUNTIME_PACKAGES) {
      if (!fs.existsSync(path.join(root, req.path))) {
        issues.push({
          code: "missing_runtime_pkg",
          message: `Missing installed package: ${req.name}`,
          autoFix: "Re-run npm install after syncing package.json.",
        });
      }
    }
  }

  try {
    const modelRaw = fs.readFileSync(
      path.join(root, "model", "expoAppModel.json"),
      "utf8"
    );
    const model = coerceExpoAppModel(JSON.parse(modelRaw));
    if (workspaceRouterOutOfSync(projectId, model)) {
      issues.push({
        code: "missing_flow_routes",
        message:
          "Launch screens (welcome / role / setup) are missing but the app model expects them — causes Unmatched Route in preview.",
        autoFix: "Regenerate expo-router screens from model before compile.",
      });
    }
  } catch {
    /* model not written yet */
  }

  return {
    projectId,
    healthy: issues.length === 0,
    issues,
    checkedAt: new Date().toISOString(),
  };
}

/** Apply safe automatic repairs — returns whether npm install should re-run. */
export function repairWorkspace(projectId: string): {
  repaired: string[];
  needsReinstall: boolean;
} {
  const repaired: string[] = [];
  let needsReinstall = false;
  const pkgPath = path.join(workspaceRootFor(projectId), "package.json");
  if (!fs.existsSync(pkgPath)) return { repaired, needsReinstall };

  let pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as typeof pkg;
  } catch {
    return { repaired, needsReinstall };
  }

  let changed = false;
  pkg.dependencies ??= {};

  for (const [name, version] of Object.entries(WEB_RUNTIME_DEPS)) {
    if (!pkg.dependencies[name]) {
      pkg.dependencies[name] = version;
      repaired.push(`added ${name}`);
      changed = true;
    }
  }

  if (pkg.devDependencies?.["eas-cli"]) {
    delete pkg.devDependencies["eas-cli"];
    repaired.push("removed eas-cli");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
    needsReinstall = true;
  }

  return { repaired, needsReinstall };
}

export function verifyRuntimePackages(projectId: string): boolean {
  const root = workspaceRootFor(projectId);
  return REQUIRED_RUNTIME_PACKAGES.every((req) =>
    fs.existsSync(path.join(root, req.path))
  );
}

/** Parse expo export / npm output and suggest a repair action. */
export function diagnoseCommandFailure(output: string): {
  repair: boolean;
  hint: string;
} | null {
  const o = output.toLowerCase();
  if (/react-native-web/.test(o) && /install|required|dependency/.test(o)) {
    return {
      repair: true,
      hint: "Added react-native-web for Expo web preview.",
    };
  }
  if (/react-dom/.test(o) && /install|required|cannot find|module not found/.test(o)) {
    return {
      repair: true,
      hint: "Added react-dom for Expo web preview.",
    };
  }
  if (/etarget|notarget|enoent/.test(o)) {
    return {
      repair: true,
      hint: "Cleared install cache and retrying npm.",
    };
  }
  if (/eresolve|peer dep|conflict/.test(o)) {
    return {
      repair: true,
      hint: "Retrying install with relaxed peer dependency rules.",
    };
  }
  return null;
}

export function summarizeCommandFailure(output: string, fallback: string): string {
  const lines = output
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const err =
    lines.find((l) =>
      /CommandError|npm error|ERR!|error:/i.test(l)
    ) ?? lines.at(-1);
  return (err ?? fallback).slice(0, 280);
}

export function writeHealthLog(
  projectId: string,
  entry: {
    action: string;
    ok: boolean;
    detail?: string;
    diagnosis?: WorkspaceDiagnosis;
  }
): void {
  try {
    const logPath = healthLogPath(projectId);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const prev = (() => {
      try {
        return JSON.parse(fs.readFileSync(logPath, "utf8")) as {
          events?: unknown[];
        };
      } catch {
        return { events: [] };
      }
    })();
    const events = Array.isArray(prev.events) ? prev.events : [];
    events.push({ ...entry, at: new Date().toISOString() });
    fs.writeFileSync(
      logPath,
      JSON.stringify({ events: events.slice(-20) }, null, 2),
      "utf8"
    );
  } catch {
    /* best effort */
  }
}

export function readHealthLog(projectId: string): {
  events: { action: string; ok: boolean; detail?: string; at: string }[];
} {
  try {
    const raw = JSON.parse(fs.readFileSync(healthLogPath(projectId), "utf8")) as {
      events?: { action: string; ok: boolean; detail?: string; at: string }[];
    };
    return { events: raw.events ?? [] };
  } catch {
    return { events: [] };
  }
}

/** Nuclear reset when repeated installs fail — removes node_modules only. */
export function clearWorkspaceNodeModules(projectId: string): void {
  const nm = path.join(workspaceRootFor(projectId), "node_modules");
  try {
    fs.rmSync(nm, { recursive: true, force: true });
  } catch {
    /* may not exist */
  }
}
