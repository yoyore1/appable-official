import fs from "node:fs";
import path from "node:path";

export interface BuildProgressState {
  projectId: string;
  stepId: string;
  label: string;
  index: number;
  total: number;
  percent: number;
  done: boolean;
  updatedAt: number;
}

/** In-process cache — backed by disk so API routes + server actions share state. */
const memory = new Map<string, BuildProgressState>();

const PROGRESS_FILE = path.join(process.cwd(), ".data", "build-progress.json");

function readDisk(): Record<string, BuildProgressState> {
  try {
    if (!fs.existsSync(PROGRESS_FILE)) return {};
    const raw = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8")) as Record<
      string,
      BuildProgressState
    >;
    return raw ?? {};
  } catch {
    return {};
  }
}

function writeDisk(all: Record<string, BuildProgressState>) {
  try {
    const dir = path.dirname(PROGRESS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(all, null, 0), "utf8");
  } catch {
    /* dev-only helper */
  }
}

function syncToDisk(projectId: string, state: BuildProgressState) {
  const all = readDisk();
  all[projectId] = state;
  writeDisk(all);
}

export function setBuildProgress(
  projectId: string,
  patch: Partial<Omit<BuildProgressState, "projectId" | "updatedAt">> & {
    stepId: string;
    label: string;
  }
) {
  const prev = memory.get(projectId) ?? readDisk()[projectId];
  const next: BuildProgressState = {
    projectId,
    stepId: patch.stepId,
    label: patch.label,
    index: patch.index ?? prev?.index ?? 0,
    total: patch.total ?? prev?.total ?? 8,
    percent: patch.percent ?? prev?.percent ?? 0,
    done: patch.done ?? false,
    updatedAt: Date.now(),
  };
  memory.set(projectId, next);
  syncToDisk(projectId, next);
}

export function getBuildProgress(projectId: string): BuildProgressState | null {
  const cached = memory.get(projectId);
  if (cached) return cached;
  const fromDisk = readDisk()[projectId];
  if (fromDisk) {
    memory.set(projectId, fromDisk);
    return fromDisk;
  }
  return null;
}

export function clearBuildProgress(projectId: string) {
  memory.delete(projectId);
  const all = readDisk();
  if (all[projectId]) {
    delete all[projectId];
    writeDisk(all);
  }
}
