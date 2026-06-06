import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isServiceAuthed } from "@/lib/serviceAuth";

/**
 * POST /api/usage
 * The build engine reports usage consumed; we decrement the user's balances.
 * Body: { userId, build?: number, review?: number }
 * Split tracking: "build" power and "review" power are separate balances.
 */
export async function POST(req: NextRequest) {
  if (!isServiceAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const userId: string | undefined = body?.userId;
  const build = Math.max(0, Number(body?.build ?? 0));
  const review = Math.max(0, Number(body?.review ?? 0));
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  const user = await db.getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const updated = await db.updateUser(userId, {
    buildPower: Math.max(0, user.buildPower - build),
    reviewBalance: Math.max(0, user.reviewBalance - review),
  });

  return NextResponse.json({
    userId,
    buildPower: updated.buildPower,
    reviewBalance: updated.reviewBalance,
  });
}
