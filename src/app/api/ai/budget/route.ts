import { NextResponse } from "next/server";
import { userAiSnapshot } from "@/lib/models/liveGeneration";
import { getCurrentUser } from "@/lib/session";

/** GET /api/ai/budget — free-tier AI usage snapshot for the signed-in user. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(userAiSnapshot(user));
}
