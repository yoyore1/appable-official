import type { ExpoAppModel } from "./types";
import { getStringAtPath, setStringAtPath } from "./tweakPaths";

export type BuildOp =
  | { op: "set"; path: string; value: string }
  | { op: "remove_role"; role: string }
  | { op: "enable_setup_back"; label?: string }
  | { op: "disable_setup_back" }
  | { op: "owner_only" };

export type AppliedBuildChange = {
  kind: "set" | "remove_role" | "setup_back" | "owner_only";
  label: string;
  path?: string;
  before?: string;
  after?: string;
};

const SET_PATH_RE =
  /^(flow\.|home\.|homeByRole\.[^.]+\.|profile\.|onboarding\[\d+\]\.|tabScreens\.[^.]+\.items\[\d+\]\.)/;

function roleMatches(role: { id: string; label: string }, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  if (!n) return false;
  const id = role.id.toLowerCase();
  const label = role.label.toLowerCase();
  return id.includes(n) || label.includes(n) || n.includes(id) || n.includes(label);
}

/** Remove a role and walker branches — collapse to owner-only when one role remains. */
export function removeRoleFromModel(model: ExpoAppModel, roleNeedle: string): ExpoAppModel {
  const next = structuredClone(model);
  if (!next.flow?.roles?.length) return model;

  const removed = next.flow.roles.filter((r) => roleMatches(r, roleNeedle));
  if (!removed.length) return model;

  next.flow.roles = next.flow.roles.filter((r) => !roleMatches(r, roleNeedle));

  if (next.homeByRole) {
    for (const r of removed) {
      delete next.homeByRole[r.id];
    }
    for (const key of Object.keys(next.homeByRole)) {
      if (/walker/i.test(key)) delete next.homeByRole[key];
    }
    if (!Object.keys(next.homeByRole).length) delete next.homeByRole;
  }

  if (next.tabScreens) {
    for (const tab of Object.keys(next.tabScreens)) {
      const screen = next.tabScreens[tab];
      if (!screen?.items) continue;
      screen.items = screen.items.filter((it) => {
        if (!it.forRole) return true;
        return !removed.some((r) => it.forRole === r.id) && !/walker/i.test(it.forRole);
      });
    }
  }

  if (next.flow.roles.length <= 1) {
    next.flow.singleRoleMode = true;
    if (next.flow.roles.length === 1) {
      const only = next.flow.roles[0]!;
      if (!next.home.headline?.trim() && next.homeByRole?.[only.id]) {
        next.home = { ...next.home, ...next.homeByRole[only.id] };
      }
    }
  }

  if (!next.flow.roles.length) {
    delete next.flow.roles;
    next.flow.singleRoleMode = true;
  }

  return next;
}

/** Owner-only: drop walker role + walker copy on setup fields. */
export function applyOwnerOnlyModel(model: ExpoAppModel): ExpoAppModel {
  let next = removeRoleFromModel(model, "walker");
  if (!next.flow) return next;

  next.flow.singleRoleMode = true;

  if (next.flow.setupFields) {
    next.flow.setupFields = next.flow.setupFields.map((f) => {
      let label = f.label;
      let placeholder = f.placeholder;
      if (/walker/i.test(label)) {
        label = label.replace(/walkers?/gi, "sitters").replace(/walking/gi, "care");
      }
      if (placeholder && /walker/i.test(placeholder)) {
        placeholder = placeholder.replace(/walkers?/gi, "your dog's care team").replace(/walking/gi, "care");
      }
      return { ...f, label, placeholder };
    });
  }

  if (next.flow.welcomeSubtitle && /walker|both sides|match/i.test(next.flow.welcomeSubtitle)) {
    next.flow.welcomeSubtitle = `Find trusted care for your dog in ${next.profile.displayName}.`;
  }

  if (next.flow.setupSubtitle && /walker/i.test(next.flow.setupSubtitle)) {
    next.flow.setupSubtitle = "A quick profile so we can personalize your experience.";
  }

  return next;
}

function canSetPath(path: string): boolean {
  return SET_PATH_RE.test(path);
}

function applySet(model: ExpoAppModel, path: string, value: string): ExpoAppModel | null {
  if (!canSetPath(path)) return null;
  const before = getStringAtPath(model, path);
  if (before === value) return null;
  const updated = setStringAtPath(model, path, value);
  return getStringAtPath(updated, path) === value ? updated : null;
}

export function applyBuildOps(
  model: ExpoAppModel,
  ops: BuildOp[]
): { model: ExpoAppModel; applied: AppliedBuildChange[] } {
  let next = model;
  const applied: AppliedBuildChange[] = [];

  for (const op of ops) {
    if (op.op === "set" && op.path && typeof op.value === "string") {
      const before = getStringAtPath(next, op.path);
      const updated = applySet(next, op.path, op.value);
      if (updated) {
        next = updated;
        applied.push({
          kind: "set",
          label: humanPathLabel(op.path),
          path: op.path,
          before,
          after: op.value,
        });
      }
      continue;
    }

    if (op.op === "remove_role" && op.role) {
      const beforeLen = next.flow?.roles?.length ?? 0;
      const updated = removeRoleFromModel(next, op.role);
      const afterLen = updated.flow?.roles?.length ?? 0;
      if (afterLen < beforeLen) {
        next = updated;
        applied.push({
          kind: "remove_role",
          label: `Removed ${op.role} role`,
        });
      }
      continue;
    }

    if (op.op === "owner_only") {
      const beforeRoles = next.flow?.roles?.length ?? 0;
      const updated = applyOwnerOnlyModel(next);
      if (
        (updated.flow?.roles?.length ?? 0) < beforeRoles ||
        updated.flow?.singleRoleMode
      ) {
        next = updated;
        applied.push({ kind: "owner_only", label: "Owner-only app (walker role removed)" });
      }
      continue;
    }

    if (op.op === "enable_setup_back") {
      if (!next.flow) continue;
      const updated = structuredClone(next);
      updated.flow = {
        ...updated.flow,
        setupShowBack: true,
        setupBackLabel: op.label?.trim() || "Back",
      };
      next = updated;
      applied.push({
        kind: "setup_back",
        label: `Back button on setup (${updated.flow.setupBackLabel})`,
      });
      continue;
    }

    if (op.op === "disable_setup_back" && next.flow?.setupShowBack) {
      const updated = structuredClone(next);
      updated.flow = { ...updated.flow!, setupShowBack: false };
      next = updated;
      applied.push({ kind: "setup_back", label: "Removed setup back button" });
    }
  }

  return { model: next, applied };
}

export function humanPathLabel(path: string): string {
  if (path.includes("setupSubmitLabel")) return "Setup button";
  if (path.includes("setupTitle")) return "Setup title";
  if (path.includes("setupSubtitle")) return "Setup subtitle";
  if (path.includes("welcomeSubtitle")) return "Welcome subtitle";
  if (path.includes("welcomeTitle")) return "Welcome title";
  if (path.includes("signInSubtitle")) return "Sign-in subtitle";
  if (path.includes("signUpSubtitle")) return "Sign-up subtitle";
  if (/onboarding\[\d+\]\.ctaLabel/.test(path)) {
    const m = path.match(/onboarding\[(\d+)\]/);
    return m ? `Onboarding slide ${Number(m[1]) + 1} button` : "Onboarding button";
  }
  if (/roles\[\d+\]\.description/.test(path)) return "Role description";
  if (/roles\[\d+\]\.label/.test(path)) return "Role title";
  if (/sections\[\d+\]\.items\[\d+\]\.badge/.test(path)) return "Listing status chip";
  if (/sections\[\d+\]\.items\[\d+\]\.meta/.test(path)) return "Listing area label";
  if (path.startsWith("home.headline")) return "Home headline";
  if (/setupFields\[\d+\]\.label/.test(path)) return "Setup field label";
  if (/setupFields\[\d+\]\.placeholder/.test(path)) return "Setup field placeholder";
  return path;
}

export function parseBuildOpsFromKimi(raw: unknown[]): BuildOp[] {
  const out: BuildOp[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const op = String(o.op ?? "").toLowerCase();
    if (op === "set" && typeof o.path === "string" && typeof o.value === "string") {
      out.push({ op: "set", path: o.path, value: o.value });
    } else if (op === "remove_role" && typeof o.role === "string") {
      out.push({ op: "remove_role", role: o.role });
    } else if (op === "owner_only") {
      out.push({ op: "owner_only" });
    } else if (op === "enable_setup_back") {
      out.push({
        op: "enable_setup_back",
        label: typeof o.label === "string" ? o.label : undefined,
      });
    } else if (op === "disable_setup_back") {
      out.push({ op: "disable_setup_back" });
    }
  }
  return out;
}
