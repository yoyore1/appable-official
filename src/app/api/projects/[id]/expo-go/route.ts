import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import {
  ensureWorkspaceDevServer,
  workspaceDevServerSnapshot,
} from "@/lib/expoWorkspaceDevServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const project = await db.getProject(id);
  if (!project || project.userId !== user.id) return null;
  return project;
}

/** Status of this project's real Expo Go dev server (Metro + tunnel). */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const project = await authorize(params.id);
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(workspaceDevServerSnapshot(params.id));
}

/** Start (or reuse) Metro for this project's workspace so Expo Go runs the real app. */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const project = await authorize(params.id);
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const result = await ensureWorkspaceDevServer(params.id);
  return NextResponse.json(result);
}
