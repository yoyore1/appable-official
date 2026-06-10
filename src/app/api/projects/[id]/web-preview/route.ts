import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import {
  triggerWorkspaceWebExport,
  webPreviewStatus,
} from "@/lib/codeAgent/webExport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const project = await db.getProject(id);
  if (!project || project.userId !== user.id) return null;
  return project;
}

/** Poll: current Expo web build status for the in-builder preview. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const project = await authorize(params.id);
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(webPreviewStatus(params.id));
}

/** Trigger (or re-trigger) a background web export of the workspace. */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const project = await authorize(params.id);
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  triggerWorkspaceWebExport(params.id);
  return NextResponse.json(webPreviewStatus(params.id));
}
