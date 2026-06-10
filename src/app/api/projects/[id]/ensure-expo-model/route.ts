import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isServiceAuthed } from "@/lib/serviceAuth";

/**
 * POST /api/projects/:id/ensure-expo-model
 * Runs the web capability + verify pipeline when Void needs expoAppModel but web Confirm wasn't done.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isServiceAuthed(_req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const project = await db.getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!project.masterPrompt) {
    return NextResponse.json({ error: "not_ready" }, { status: 409 });
  }

  if (project.expoAppModel) {
    return NextResponse.json({
      built: false,
      model: project.expoAppModel,
      passes: project.expoAppModel.capabilityAudit?.pass ?? null,
    });
  }

  const { buildExpoAppModel } = await import("@/lib/expoApp/generate");

  const built = await buildExpoAppModel(
    project.masterPrompt,
    params.id,
    undefined,
    project.interview ?? []
  );

  if (!built?.model) {
    return NextResponse.json({ error: "model_build_failed" }, { status: 500 });
  }

  await db.updateProject(params.id, {
    expoAppModel: built.model,
    status: project.status === "interviewing" ? "ready" : project.status,
  });

  return NextResponse.json({
    built: true,
    model: built.model,
    passes: built.passes,
    capabilityPass: built.model.capabilityAudit?.pass ?? null,
  });
}
