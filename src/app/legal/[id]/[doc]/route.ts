import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { legalDoc } from "@/lib/legal";

/** Public hosted Privacy / Terms / Support pages for a project (free inclusion). */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; doc: string } }
) {
  const doc = params.doc as "privacy" | "terms" | "support";
  if (!["privacy", "terms", "support"].includes(doc)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const project = await db.getProject(params.id);
  if (!project?.masterPrompt) {
    return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(legalDoc(doc, project.masterPrompt), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
