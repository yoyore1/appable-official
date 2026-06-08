import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { ensureExpoDevServer } from "@/lib/expoDevServer";
import { apiBaseForExpoShell } from "@/lib/expoGoUrl";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Auto-start Metro + tunnel when user opens the build room or finishes a build. */
export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }

  const h = headers();
  const apiBase = apiBaseForExpoShell(
    h.get("x-forwarded-host") ?? h.get("host"),
    h.get("x-forwarded-proto")
  );

  const result = await ensureExpoDevServer(apiBase);
  return NextResponse.json(result);
}
