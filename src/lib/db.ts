/**
 * Data-access layer. Currently backed by the in-memory mock store so the whole
 * platform runs with no external services. Each method maps 1:1 to a Supabase
 * table operation (see /supabase/migrations/0001_init.sql) — when you add
 * Supabase keys, swap the bodies here for Supabase queries and nothing else in
 * the app needs to change.
 */
import { integrations } from "@/lib/config";
import { saveStore, store } from "@/lib/mock/store";
import { uid } from "@/lib/utils";
import type {
  BuildTarget,
  CachedBuild,
  HandoffToken,
  Project,
  UserAccount,
  Vibe,
} from "@/lib/types";

if (integrations.supabase) {
  // eslint-disable-next-line no-console
  console.warn(
    "[appable] Supabase keys detected, but db.ts is using the mock store. " +
      "Wire Supabase queries in src/lib/db.ts to go live. See README."
  );
}

function now() {
  return new Date().toISOString();
}

export const db = {
  // ---- users ---------------------------------------------------------------
  async createUser(input: {
    email: string;
    password?: string;
    name?: string | null;
  }): Promise<UserAccount> {
    const s = store();
    const email = input.email.toLowerCase();
    const user: UserAccount = {
      id: uid("usr"),
      email,
      name: input.name ?? null,
      depositPaid: false,
      buildPower: 0,
      reviewBalance: 0,
      dataSharingOptIn: false,
      isAdmin: s.users.size === 0, // first user is admin (founder) in mock mode
      courseTierId: null,
      aiUsageUsd: 0,
      ttsCharsUsed: 0,
      createdAt: now(),
    };
    s.users.set(user.id, user);
    if (input.password) s.passwords.set(email, input.password);
    saveStore();
    return user;
  },

  async getUserById(id: string): Promise<UserAccount | undefined> {
    return store().users.get(id);
  },

  async getUserByEmail(email: string): Promise<UserAccount | undefined> {
    const target = email.toLowerCase();
    for (const u of store().users.values()) {
      if (u.email === target) return u;
    }
    return undefined;
  },

  async verifyPassword(email: string, password: string): Promise<boolean> {
    return store().passwords.get(email.toLowerCase()) === password;
  },

  async updateUser(
    id: string,
    patch: Partial<UserAccount>
  ): Promise<UserAccount> {
    const s = store();
    const u = s.users.get(id);
    if (!u) throw new Error("USER_NOT_FOUND");
    const next = { ...u, ...patch, id: u.id };
    s.users.set(id, next);
    saveStore();
    return next;
  },

  async addBuildPower(id: string, amount: number): Promise<UserAccount> {
    const u = await this.getUserById(id);
    if (!u) throw new Error("USER_NOT_FOUND");
    return this.updateUser(id, { buildPower: u.buildPower + amount });
  },

  async addReviewBalance(id: string, amount: number): Promise<UserAccount> {
    const u = await this.getUserById(id);
    if (!u) throw new Error("USER_NOT_FOUND");
    return this.updateUser(id, { reviewBalance: u.reviewBalance + amount });
  },

  // ---- projects ------------------------------------------------------------
  async createProject(userId: string, name = "Untitled app"): Promise<Project> {
    const s = store();
    const p: Project = {
      id: uid("prj"),
      userId,
      name,
      status: "interviewing",
      vibe: null,
      thumbnailHue: Math.floor(Math.random() * 40) - 10, // around coral
      interview: [],
      masterPrompt: null,
      launch: { purchased: false },
      legal: {},
      target: null,
      githubRepoUrl: null,
      expoAppModel: null,
      expoPreviewToken: null,
      readinessState: null,
      brainstormState: null,
      aiUsageUsd: 0,
      createdAt: now(),
      updatedAt: now(),
    };
    s.projects.set(p.id, p);
    saveStore();
    return p;
  },

  async getProject(id: string): Promise<Project | undefined> {
    return store().projects.get(id);
  },

  async listProjects(userId: string): Promise<Project[]> {
    return [...store().projects.values()]
      .filter((p) => p.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async updateProject(id: string, patch: Partial<Project>): Promise<Project> {
    const s = store();
    const p = s.projects.get(id);
    if (!p) throw new Error("PROJECT_NOT_FOUND");
    const next = { ...p, ...patch, id: p.id, updatedAt: now() };
    s.projects.set(id, next);
    saveStore();
    return next;
  },

  // ---- handoff tokens (web → Builder, single-use, short-lived) -------------
  async createHandoff(
    userId: string,
    projectId: string,
    target: BuildTarget | null,
    ttlMs = 15 * 60 * 1000
  ): Promise<HandoffToken> {
    const s = store();
    const t: HandoffToken = {
      token: `${uid("ho")}${uid("k").slice(2)}`,
      userId,
      projectId,
      target,
      createdAt: now(),
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      usedAt: null,
    };
    s.handoffs.set(t.token, t);
    saveStore();
    return t;
  },

  async getHandoff(token: string): Promise<HandoffToken | undefined> {
    return store().handoffs.get(token);
  },

  /** Validate + consume a handoff token. Returns the token if still valid. */
  async consumeHandoff(token: string): Promise<HandoffToken | null> {
    const s = store();
    const t = s.handoffs.get(token);
    if (!t) return null;
    if (t.usedAt) return null;
    if (new Date(t.expiresAt).getTime() < Date.now()) return null;
    const used = { ...t, usedAt: now() };
    s.handoffs.set(token, used);
    saveStore();
    return used;
  },

  // ---- cache (pgvector in production) --------------------------------------
  async addCachedBuild(input: {
    userId: string;
    category: string;
    features: string[];
    vibe: Vibe;
    colors: string;
    codeRef: string;
    shared: boolean;
  }): Promise<CachedBuild> {
    const s = store();
    const c: CachedBuild = { id: uid("cache"), createdAt: now(), ...input };
    s.cachedBuilds.set(c.id, c);
    saveStore();
    return c;
  },

  /**
   * Mock similarity: Jaccard overlap on features + category/vibe match, instead
   * of pgvector cosine distance. Returns top-N visible to the user (shared OR own).
   */
  async findSimilarBuilds(
    spec: { category: string; features: string[]; vibe?: Vibe },
    userId: string | null,
    limit = 5
  ): Promise<(CachedBuild & { score: number })[]> {
    const wanted = new Set(spec.features.map((f) => f.toLowerCase()));
    const scored = [...store().cachedBuilds.values()]
      .filter((c) => c.shared || c.userId === userId)
      .map((c) => {
        const have = new Set(c.features.map((f) => f.toLowerCase()));
        const inter = [...wanted].filter((f) => have.has(f)).length;
        const union = new Set([...wanted, ...have]).size || 1;
        let score = inter / union;
        if (c.category.toLowerCase() === spec.category.toLowerCase()) score += 0.25;
        if (spec.vibe && c.vibe === spec.vibe) score += 0.1;
        return { ...c, score };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored;
  },

  async cacheStats() {
    const builds = [...store().cachedBuilds.values()];
    const shared = builds.filter((b) => b.shared).length;
    return {
      total: builds.length,
      shared,
      estimatedSavingsUsd: builds.length * 0.42, // illustrative
    };
  },

  async platformStats() {
    const s = store();
    const users = [...s.users.values()];
    const projects = [...s.projects.values()];
    return {
      users: users.length,
      depositsPaid: users.filter((u) => u.depositPaid).length,
      courseSubs: users.filter((u) => u.courseTierId).length,
      projects: projects.length,
      liveApps: projects.filter((p) => p.status === "live").length,
      buildsReady: projects.filter((p) => p.masterPrompt).length,
    };
  },
};
