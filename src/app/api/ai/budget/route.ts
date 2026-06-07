import { NextRequest, NextResponse } from "next/server";
import { getAiSpentUsd } from "@/lib/aiBudgetAccount";
import { publicUsageSnapshot } from "@/lib/aiUsage";
import { userPublicAiUsage } from "@/lib/models/liveGeneration";
import { resolveProjectAccess } from "@/lib/projectAccess";
import { getCurrentUser } from "@/lib/session";

/** GET /api/ai/budget — % remaining (no dollar amounts). ?projectId= for guest interview sessions. */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId")?.trim();
  if (projectId) {
    const access = await resolveProjectAccess(projectId);
    if (!access.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const spent = await getAiSpentUsd(access.project, access.isGuest);
    return NextResponse.json(publicUsageSnapshot(spent));
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(userPublicAiUsage(user));
}
