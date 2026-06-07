import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isServiceAuthed } from "@/lib/serviceAuth";

/**
 * GET /api/apps/:id
 * Full app context for the Builder to open/continue an app: master prompt +
 * repo URL (so it can pull the current state) + target. Service-key auth.
 */
export async function GET(
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
  if (!project.masterPrompt) {
    return NextResponse.json({ error: "not_ready" }, { status: 409 });
  }

  return NextResponse.json({
    app: {
      id: project.id,
      userId: project.userId,
      name: project.name,
      target: project.target,
      status: project.status,
      githubRepoUrl: project.githubRepoUrl,
    },
    masterPrompt: project.masterPrompt,
  });
}
