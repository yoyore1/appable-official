import { NextRequest, NextResponse } from "next/server";
import { getBuildProgress } from "@/lib/buildProgressStore";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/** GET build progress while runExpoWebBuild is running. */
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

  const progress = getBuildProgress(params.id);
  if (!progress) {
    return NextResponse.json({ active: false });
  }

  return NextResponse.json({ active: true, ...progress });
}
