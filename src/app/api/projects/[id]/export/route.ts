import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { exportZipUrl } from "@/lib/github";
import { github } from "@/lib/config";

/**
 * GET /api/projects/:id/export
 * "Export your code" — your app is yours, download it anytime. In live mode this
 * streams the app's private GitHub repo as a zip. In mock mode (no GitHub token)
 * it returns a manifest explaining where the code lives + how to export from the
 * Builder, so ownership stays honest without pretending files exist server-side.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const project = await db.getProject(params.id);
  if (!project || project.userId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const zipUrl = project.githubRepoUrl ? exportZipUrl(project.githubRepoUrl) : null;

  if (zipUrl && github.orgToken) {
    const res = await fetch(zipUrl, {
      headers: {
        Authorization: `Bearer ${github.orgToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok || !res.body) {
      return NextResponse.json({ error: "export_failed" }, { status: 502 });
    }
    return new NextResponse(res.body, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${project.name}-code.zip"`,
      },
    });
  }

  // Mock mode: honest manifest instead of a fake zip.
  const manifest = [
    `# ${project.name} — your code`,
    "",
    "Your app is yours. Here's where the code lives and how to export it:",
    "",
    `- App ID: ${project.id}`,
    `- Repo: ${project.githubRepoUrl ?? "(created on first build)"}`,
    `- Target: ${project.target ?? "(choose in the Builder)"}`,
    "",
    "To download the full project: open this app in Appable Builder and click",
    '"Export your code" — it zips the live project from your machine.',
    "",
    "(This platform is running without a GitHub token, so no server-side zip is",
    "available yet. Set GITHUB_ORG_TOKEN to enable one-click repo export here.)",
  ].join("\n");

  return new NextResponse(manifest, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.name}-export.md"`,
    },
  });
}
