import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Lightweight liveness probe for Railway / load balancers. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
