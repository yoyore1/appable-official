/**
 * Appable platform client. Calls the Part 1 web platform's service-key API:
 *   - validate a user + read balances
 *   - fetch a master build prompt by project ID
 *   - report usage consumed (build/review split)
 *   - read/write the build cache (find_similar / post completed)
 *
 * If APPABLE_API_URL isn't set, every call falls back to a believable mock so
 * the engine runs standalone.
 */
import { integrations, platform } from "./config.js";
import type { MasterBuildPrompt, SimilarBuild, UsageReport, Vibe } from "./types.js";

const sampleMasterPrompt: MasterBuildPrompt = {
  appName: "PlantPal",
  description: "A calm companion that reminds you to water your plants and tracks their health.",
  audience: "Busy plant lovers who forget to water.",
  features: ["Watering reminders", "Plant journal", "Care tips"],
  vibe: "Soft",
  colors: "Sage green & cream",
  screens: ["Onboarding", "Home", "Watering reminders screen", "Plant journal screen", "Profile"],
};

async function api<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${platform.url}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${platform.key}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`platform ${path} → ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface PlatformUser {
  userId: string;
  email: string;
  name: string | null;
  buildPower: number;
  reviewBalance: number;
  dataSharingOptIn: boolean;
  depositPaid: boolean;
}

export async function validateUser(
  email: string,
  password: string
): Promise<PlatformUser> {
  if (!integrations.platform) {
    return {
      userId: "usr_mock",
      email,
      name: "Mock Builder",
      buildPower: 5000,
      reviewBalance: 200,
      dataSharingOptIn: true,
      depositPaid: true,
    };
  }
  return api<PlatformUser>("/api/auth/validate", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchMasterPrompt(
  projectId: string
): Promise<{ projectId: string; userId: string; masterPrompt: MasterBuildPrompt }> {
  if (!integrations.platform || projectId === "sample") {
    return { projectId: "sample", userId: "usr_mock", masterPrompt: sampleMasterPrompt };
  }
  const res = await api<{ projectId: string; userId: string; masterPrompt: MasterBuildPrompt }>(
    `/api/projects/${projectId}/master-prompt`,
    { method: "GET" }
  );
  return res;
}

export async function reportUsage(userId: string, usage: UsageReport): Promise<void> {
  if (!integrations.platform || userId === "usr_mock") return;
  await api("/api/usage", {
    method: "POST",
    body: JSON.stringify({ userId, build: usage.build, review: usage.review }),
  });
}

export async function findSimilar(
  spec: { category: string; features: string[]; vibe?: Vibe },
  userId: string | null
): Promise<SimilarBuild[]> {
  if (!integrations.platform) return [];
  try {
    const res = await api<{ matches: SimilarBuild[] }>("/api/cache/similar", {
      method: "POST",
      body: JSON.stringify({ spec, userId, limit: 3 }),
    });
    return res.matches ?? [];
  } catch {
    return [];
  }
}

export async function postCache(input: {
  userId: string;
  category: string;
  features: string[];
  vibe: Vibe;
  colors: string;
  codeRef: string;
}): Promise<void> {
  if (!integrations.platform || input.userId === "usr_mock") return;
  try {
    await api("/api/cache", { method: "POST", body: JSON.stringify(input) });
  } catch {
    // caching is best-effort; never block a build on it
  }
}
