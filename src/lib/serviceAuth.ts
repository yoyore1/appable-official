import { NextRequest } from "next/server";
import { serviceKey } from "@/lib/config";

/**
 * Guards the platform endpoints the build engine calls. The Builder sends the
 * shared APPABLE_SERVICE_KEY as a Bearer token (or x-appable-key header).
 */
export function isServiceAuthed(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : undefined;
  const header = req.headers.get("x-appable-key") ?? undefined;
  return bearer === serviceKey || header === serviceKey;
}
