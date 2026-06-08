import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isServiceAuthed } from "@/lib/serviceAuth";
import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";

/**
 * POST /api/projects/from-builder-interview
 * Void Builder syncs a completed interview + master plan (service-key auth).
 */
export async function POST(req: NextRequest) {
  if (!isServiceAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    userId?: string;
    interview?: InterviewTurn[];
    masterPrompt?: MasterBuildPrompt;
    target?: "rn" | "swift";
  } | null;

  const userId = body?.userId?.trim();
  const masterPrompt = body?.masterPrompt;
  const interview = Array.isArray(body?.interview) ? body!.interview : [];

  if (!userId || !masterPrompt?.appName) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const user = await db.getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const project = await db.createProject(userId);
  const legal = {
    privacyUrl: `/legal/${project.id}/privacy`,
    termsUrl: `/legal/${project.id}/terms`,
    supportUrl: `/legal/${project.id}/support`,
  };

  await db.updateProject(project.id, {
    name: masterPrompt.appName,
    vibe: masterPrompt.vibe,
    interview,
    masterPrompt,
    status: "ready",
    target: body?.target ?? "swift",
    legal,
  });

  return NextResponse.json({ projectId: project.id });
}
