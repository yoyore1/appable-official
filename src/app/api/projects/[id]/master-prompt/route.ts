import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isServiceAuthed } from "@/lib/serviceAuth";

/**
 * GET /api/projects/:id/master-prompt
 * The build engine fetches a project's master build prompt by ID. Service-key auth.
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
    projectId: project.id,
    userId: project.userId,
    status: project.status,
    masterPrompt: project.masterPrompt,
  });
}
