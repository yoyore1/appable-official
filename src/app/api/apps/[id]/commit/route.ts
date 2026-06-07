import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isServiceAuthed } from "@/lib/serviceAuth";
import { commitAppState, ensureRepoForApp } from "@/lib/github";
import type { BuildTarget, ProjectStatus } from "@/lib/types";

interface CommitBody {
  files?: { path: string; contents: string }[];
  message?: string;
  status?: ProjectStatus;
  target?: BuildTarget;
}

/**
 * POST /api/apps/:id/commit
 * Silent auto-commit of the app's current state (invisible version control).
 * The Builder calls this after build steps / change thresholds — the user never
 * triggers it and never sees the word "commit." Service-key auth.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isServiceAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const project = await db.getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as CommitBody;

  let githubRepoUrl = project.githubRepoUrl;
  if (!githubRepoUrl) githubRepoUrl = await ensureRepoForApp(project);

  if (body.files?.length) {
    try {
      await commitAppState(
        githubRepoUrl,
        body.files,
        body.message ?? "Update from Appable Builder"
      );
    } catch (e) {
      // Best-effort: never block a build on version control.
      return NextResponse.json({
        ok: true,
        committed: false,
        githubRepoUrl,
        note: String((e as Error)?.message ?? e),
      });
    }
  }

  await db.updateProject(params.id, {
    githubRepoUrl,
    ...(body.status ? { status: body.status } : {}),
    ...(body.target ? { target: body.target } : {}),
  });

  return NextResponse.json({ ok: true, committed: Boolean(body.files?.length), githubRepoUrl });
}
