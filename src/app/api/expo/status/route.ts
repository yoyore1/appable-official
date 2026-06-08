import { NextResponse } from "next/server";
import { expoDevServerSnapshot } from "@/lib/expoDevServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snap = expoDevServerSnapshot();
  return NextResponse.json(snap);
}
