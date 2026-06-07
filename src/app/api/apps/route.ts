import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isServiceAuthed } from "@/lib/serviceAuth";

/**
 * GET /api/apps?userId=...
 * The Builder lists every app for a signed-in user (same account as the web).
 * Service-key auth. Only projects with a master prompt are real, openable apps.
 */
export async function GET(req: NextRequest) {
  if (!isServiceAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "missing_user" }, { status: 400 });
  }

  const projects = await db.listProjects(userId);
  const apps = projects
    .filter((p) => p.masterPrompt)
    .map((p) => ({
      id: p.id,
      name: p.name,
      target: p.target,
      status: p.status,
      githubRepoUrl: p.githubRepoUrl,
      vibe: p.vibe,
      thumbnailHue: p.thumbnailHue,
      updatedAt: p.updatedAt,
    }));

  return NextResponse.json({ apps });
}
