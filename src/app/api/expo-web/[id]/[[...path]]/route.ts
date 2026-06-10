import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { injectPreviewHtml } from "@/lib/codeAgent/previewBaseShim";
import { workspaceWebDistFile } from "@/lib/codeAgent/webExport";
import { TAP_EDIT_BRIDGE } from "@/lib/codeAgent/tapEditBridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};

/** Serve the per-project Expo web build (dist/) for the in-builder iframe. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; path?: string[] } }
) {
  const file = workspaceWebDistFile(params.id, params.path ?? []);
  if (!file) {
    return new NextResponse(
      "<!doctype html><meta charset=utf-8><body style=\"font-family:system-ui;padding:24px;color:#5C534F\">Building your app…</body>",
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext] ?? "application/octet-stream";

  if (ext === ".html") {
    let html = await readFile(file, "utf8");
    html = injectPreviewHtml(html, params.id, TAP_EDIT_BRIDGE);
    return new NextResponse(html, {
      status: 200,
      headers: { "content-type": type, "cache-control": "no-store" },
    });
  }

  const data = await readFile(file);
  return new NextResponse(data, {
    status: 200,
    headers: {
      "content-type": type,
      "cache-control": "no-store",
    },
  });
}
