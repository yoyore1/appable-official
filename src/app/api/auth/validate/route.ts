import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isServiceAuthed } from "@/lib/serviceAuth";

/**
 * POST /api/auth/validate
 * The Builder logs a user in against the platform and reads their balance.
 * Body: { email, password }  (service-key auth on the request)
 * Returns the user id + current build/review balances.
 */
export async function POST(req: NextRequest) {
  if (!isServiceAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);

  /** Local dev: Builder can skip real login when service key matches. */
  if (
    process.env.NODE_ENV !== "production" &&
    (body?.devBypass === true || body?.email === "dev@appable.local")
  ) {
    return NextResponse.json({
      userId: "usr_dev",
      email: "dev@appable.local",
      name: "Dev",
      buildPower: 99_999,
      reviewBalance: 500,
      dataSharingOptIn: true,
      depositPaid: true,
    });
  }

  const email: string | undefined = body?.email;
  const password: string | undefined = body?.password;
  if (!email || !password) {
    return NextResponse.json({ error: "email_and_password_required" }, { status: 400 });
  }

  const user = await db.getUserByEmail(email);
  if (!user || !(await db.verifyPassword(email, password))) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    name: user.name,
    buildPower: user.buildPower,
    reviewBalance: user.reviewBalance,
    dataSharingOptIn: user.dataSharingOptIn,
    depositPaid: user.depositPaid,
  });
}
