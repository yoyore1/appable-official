/**
 * In-memory data store used when Supabase isn't configured (MOCK MODE).
 *
 * Persists to .data/mock-store.json in dev so restarts don't wipe interviews.
 * The shape mirrors the Supabase schema in /supabase/migrations.
 */
import fs from "node:fs";
import path from "node:path";
import type { CachedBuild, Project, UserAccount } from "@/lib/types";

interface Store {
  users: Map<string, UserAccount>;
  /** email (lowercased) -> password (mock only, plaintext, dev convenience) */
  passwords: Map<string, string>;
  projects: Map<string, Project>;
  cachedBuilds: Map<string, CachedBuild>;
  seeded: boolean;
}

interface SerializedStore {
  users: [string, UserAccount][];
  passwords: [string, string][];
  projects: [string, Project][];
  cachedBuilds: [string, CachedBuild][];
  seeded: boolean;
}

const g = globalThis as unknown as { __appableStore?: Store };

const DATA_FILE = path.join(process.cwd(), ".data", "mock-store.json");

function create(): Store {
  return {
    users: new Map(),
    passwords: new Map(),
    projects: new Map(),
    cachedBuilds: new Map(),
    seeded: false,
  };
}

function loadFromDisk(): Store | null {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as SerializedStore;
    return {
      users: new Map(raw.users ?? []),
      passwords: new Map(raw.passwords ?? []),
      projects: new Map(raw.projects ?? []),
      cachedBuilds: new Map(raw.cachedBuilds ?? []),
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
  return g.__appableStore;
}
