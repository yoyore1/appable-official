import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

/** Expo Go shell fetches the built app model — token-gated, no session. */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400, headers: cors });
  }

  const project = await db.getProject(params.id);
  if (!project?.expoAppModel) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: cors });
  }
  if (!project.expoPreviewToken || project.expoPreviewToken !== token) {
    return NextResponse.json({ error: "invalid_token" }, { status: 403, headers: cors });
  }

  return NextResponse.json(
    {
      appName: project.masterPrompt?.appName ?? project.name,
      model: project.expoAppModel,
    },
    { headers: cors }
  );
}
