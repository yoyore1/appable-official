import { NextResponse } from "next/server";
import { resolveProjectAccess } from "@/lib/projectAccess";
import {
  bootstrapWorkspaceRuntime,
  rebuildWorkspaceRuntime,
  workspaceRuntimeStatus,
} from "@/lib/codeAgent/workspaceRuntime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Poll combined runtime status (deps, web build, Metro). */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const access = await resolveProjectAccess(params.id);
  if (!access.ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(workspaceRuntimeStatus(params.id));
}

/**
 * Auto-start everything — npm install, web compile, Metro tunnel.
 * No prompts; runs in the background on the server.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const access = await resolveProjectAccess(params.id);
  if (!access.ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const rebuild = new URL(req.url).searchParams.get("rebuild") === "1";
  if (rebuild) {
    rebuildWorkspaceRuntime(params.id);
  } else {
    bootstrapWorkspaceRuntime(params.id);
  }
  return NextResponse.json(workspaceRuntimeStatus(params.id));
}
