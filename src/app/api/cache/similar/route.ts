import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isServiceAuthed } from "@/lib/serviceAuth";
import type { Vibe } from "@/lib/types";

/**
 * POST /api/cache/similar  (find_similar_builds)
 * Returns top-N cached builds similar to a spec, filtered to shared=true OR the
 * same user. The build engine injects these as reference templates before
 * generating, so it adapts rather than building from scratch.
 * Body: { spec: { category, features[], vibe? }, userId?, limit? }
 */
export async function POST(req: NextRequest) {
  if (!isServiceAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const spec = body?.spec;
  if (!spec?.category || !Array.isArray(spec?.features)) {
    return NextResponse.json({ error: "invalid_spec" }, { status: 400 });
  }
  const userId: string | null = body?.userId ?? null;
  const limit = Math.min(20, Math.max(1, Number(body?.limit ?? 5)));

  const results = await db.findSimilarBuilds(
    {
      category: String(spec.category),
      features: spec.features.map(String),
      vibe: spec.vibe as Vibe | undefined,
    },
    userId,
    limit
  );

  return NextResponse.json({
    matches: results.map((r) => ({
      id: r.id,
      category: r.category,
      features: r.features,
      vibe: r.vibe,
      colors: r.colors,
      codeRef: r.codeRef,
      score: Number(r.score.toFixed(3)),
    })),
  });
}
