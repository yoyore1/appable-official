/**
 * GitHub repo-per-app service — invisible version control.
 *
 * Each Appable app gets its own PRIVATE repo under an Appable-managed org. The
 * user never sees GitHub, never logs in there, never sees the word "commit."
 * We only store the mapping user_id → app_id → github_repo_url in Supabase
 * (the mock store in dev).
 *
 * MOCK MODE: when GITHUB_ORG_TOKEN is absent we return a deterministic mock repo
 * URL and treat commits/exports as no-ops, so the whole flow runs locally with
 * zero GitHub setup. Set GITHUB_ORG_TOKEN + GITHUB_ORG to go live.
 */
import { github, integrations } from "@/lib/config";
import type { Project } from "@/lib/types";

const API = "https://api.github.com";

/** Stable, collision-resistant repo slug: appable-apps/user-{userId}-{appName}. */
export function repoNameFor(userId: string, appName: string): string {
  const safeName = (appName || "app")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "app";
  const safeUser = userId.replace(/[^a-zA-Z0-9]+/g, "").slice(0, 16);
  return `user-${safeUser}-${safeName}`;
}

function repoUrl(repo: string): string {
  return `https://github.com/${github.org}/${repo}`;
}

async function gh<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${github.orgToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok && res.status !== 422 /* already exists */) {
    const body = await res.text().catch(() => "");
    throw new Error(`github ${path} → ${res.status} ${body.slice(0, 160)}`);
  }
  return (res.status === 422 ? ({} as T) : ((await res.json()) as T));
}

/**
 * Ensure a private repo exists for this app and return its URL. Idempotent.
 * In mock mode returns a deterministic mock URL without hitting GitHub.
 */
export async function ensureRepoForApp(
  project: Pick<Project, "userId" | "name" | "githubRepoUrl">
): Promise<string> {
  if (project.githubRepoUrl) return project.githubRepoUrl;
  const repo = repoNameFor(project.userId, project.name);

  if (!integrations.github) {
    // Mock: no real repo, but a stable URL so the rest of the flow works.
    return `${repoUrl(repo)}#mock`;
  }

  await gh(`/orgs/${github.org}/repos`, {
    method: "POST",
    body: JSON.stringify({
      name: repo,
      private: true,
      auto_init: true,
      description: "Built with Appable — your app, your code.",
    }),
  });
  return repoUrl(repo);
}

/**
 * Silent auto-commit of the app's current state. Called by the build engine
 * (server-side) after build steps. Mock mode is a no-op. Real mode upserts a
 * single file via the Contents API so users get free version history.
 */
export async function commitAppState(
  repoFullName: string,
  files: { path: string; contents: string }[],
  message: string
): Promise<void> {
  if (!integrations.github || repoFullName.includes("#mock")) return;
  const [owner, repo] = repoFullNameToParts(repoFullName);
  for (const f of files) {
    // Look up existing sha (needed to update an existing file).
    let sha: string | undefined;
    try {
      const existing = await gh<{ sha: string }>(
        `/repos/${owner}/${repo}/contents/${encodeURIComponent(f.path)}`,
        { method: "GET" }
      );
      sha = existing.sha;
    } catch {
      /* new file */
    }
    await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(f.path)}`, {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: Buffer.from(f.contents, "utf8").toString("base64"),
        ...(sha ? { sha } : {}),
      }),
    });
  }
}

/** GitHub zipball URL for "Export your code" (real mode). */
export function exportZipUrl(repoFullName: string): string | null {
  if (!integrations.github || repoFullName.includes("#mock")) return null;
  const [owner, repo] = repoFullNameToParts(repoFullName);
  return `${API}/repos/${owner}/${repo}/zipball`;
}

function repoFullNameToParts(url: string): [string, string] {
  const clean = url.replace("#mock", "").replace(/^https?:\/\/github\.com\//, "");
  const [owner, repo] = clean.split("/");
  return [owner ?? github.org, repo ?? ""];
}
