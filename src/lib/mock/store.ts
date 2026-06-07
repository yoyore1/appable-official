/**
 * In-memory data store used when Supabase isn't configured (MOCK MODE).
 *
 * Persists to .data/mock-store.json in dev so restarts don't wipe interviews.
 * The shape mirrors the Supabase schema in /supabase/migrations.
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeMasterPrompt } from "@/lib/archetypes";
import type {
  CachedBuild,
  HandoffToken,
  Project,
  UserAccount,
} from "@/lib/types";

interface Store {
  users: Map<string, UserAccount>;
  /** email (lowercased) -> password (mock only, plaintext, dev convenience) */
  passwords: Map<string, string>;
  projects: Map<string, Project>;
  cachedBuilds: Map<string, CachedBuild>;
  /** short-lived web→Builder handoff tokens, keyed by token */
  handoffs: Map<string, HandoffToken>;
  seeded: boolean;
}

interface SerializedStore {
  users: [string, UserAccount][];
  passwords: [string, string][];
  projects: [string, Project][];
  cachedBuilds: [string, CachedBuild][];
  handoffs?: [string, HandoffToken][];
  seeded: boolean;
}

/** Backfill fields added in later phases onto projects loaded from older stores. */
function migrateUser(u: UserAccount): UserAccount {
  return {
    ...u,
    aiUsageUsd: u.aiUsageUsd ?? 0,
    ttsCharsUsed: u.ttsCharsUsed ?? 0,
  };
}

function migrateProject(p: Project): Project {
  return {
    ...p,
    target: p.target ?? null,
    githubRepoUrl: p.githubRepoUrl ?? null,
    expoAppModel: p.expoAppModel ?? null,
    masterPrompt: p.masterPrompt ? normalizeMasterPrompt(p.masterPrompt) : null,
  };
}

const g = globalThis as unknown as { __appableStore?: Store };

const DATA_FILE = path.join(process.cwd(), ".data", "mock-store.json");

function create(): Store {
  return {
    users: new Map(),
    passwords: new Map(),
    projects: new Map(),
    cachedBuilds: new Map(),
    handoffs: new Map(),
    seeded: false,
  };
}

function loadFromDisk(): Store | null {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as SerializedStore;
    const projects = new Map<string, Project>(
      (raw.projects ?? []).map(([id, p]) => [id, migrateProject(p)])
    );
    return {
      users: new Map(
        (raw.users ?? []).map(([id, u]) => [id, migrateUser(u)])
      ),
      passwords: new Map(raw.passwords ?? []),
      projects,
      cachedBuilds: new Map(raw.cachedBuilds ?? []),
      handoffs: new Map(raw.handoffs ?? []),
      seeded: raw.seeded ?? false,
    };
  } catch {
    return null;
  }
}

/** Write mock store to disk (dev only). */
export function saveStore(): void {
  const s = g.__appableStore;
  if (!s) return;
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const payload: SerializedStore = {
      users: [...s.users.entries()],
      passwords: [...s.passwords.entries()],
      projects: [...s.projects.entries()],
      cachedBuilds: [...s.cachedBuilds.entries()],
      handoffs: [...s.handoffs.entries()],
      seeded: s.seeded,
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(payload));
  } catch (err) {
    console.warn("[mock store] persist failed:", err);
  }
}

export function store(): Store {
  if (!g.__appableStore) {
    g.__appableStore = loadFromDisk() ?? create();
  }
  // Defensive: backfill maps added in later phases onto a store that may have
  // been created by an older build still alive across HMR / dev reloads.
  if (!g.__appableStore.handoffs) {
    g.__appableStore.handoffs = new Map();
  }
  return g.__appableStore;
}
