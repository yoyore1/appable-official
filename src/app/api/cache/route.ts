import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isServiceAuthed } from "@/lib/serviceAuth";
import type { Vibe } from "@/lib/types";

/**
 * POST /api/cache
 * The build engine posts a completed build so it can be reused later. Honors the
 * user's data-sharing opt-in: shared=true only if the user allowed it.
 * Body: { userId, category, features[], vibe, colors, codeRef }
 */
export async function POST(req: NextRequest) {
  if (!isServiceAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const { userId, category, features, vibe, colors, codeRef } = body ?? {};
  if (!userId || !category || !Array.isArray(features) || !codeRef) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const user = await db.getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const cached = await db.addCachedBuild({
    userId,
    category: String(category),
    features: features.map(String),
    vibe: (vibe ?? "Minimal") as Vibe,
    colors: String(colors ?? ""),
    codeRef: String(codeRef),
    shared: user.dataSharingOptIn === true,
  });

  return NextResponse.json({ id: cached.id, shared: cached.shared });
}
