import { NextRequest, NextResponse } from "next/server";
import { userAiSnapshot, runLiveGeneration } from "@/lib/models/liveGeneration";
import type { LiveGenerationInput } from "@/lib/models/liveGeneration";
import { getCurrentUser } from "@/lib/session";

/**
 * POST /api/ai/live
 * Capped live AI for built apps (vision, STT, TTS, images, embed, rerank).
 * Body: { capability, text?, imageUrl?, audioBase64?, documents?, seedanceImageUrl? }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | (LiveGenerationInput & { capability?: string })
    | null;

  const capability = body?.capability?.trim();
  if (!capability) {
    return NextResponse.json({ error: "capability required" }, { status: 400 });
  }

  const result = await runLiveGeneration(
    user,
    capability,
    {
      text: body?.text,
      imageUrl: body?.imageUrl,
      audioBase64: body?.audioBase64,
      audioMimeType: body?.audioMimeType,
      documents: body?.documents,
      seedanceImageUrl: body?.seedanceImageUrl,
    }
  );

  const usage = userAiSnapshot(
    result.ok
      ? {
          aiUsageUsd: user.aiUsageUsd + result.costUsd,
          ttsCharsUsed:
            user.ttsCharsUsed +
            (result.task === "text_to_speech" ? (body?.text?.length ?? 0) : 0),
        }
      : user
  );

  if (!result.ok) {
    const status =
      result.reason === "cap_reached"
        ? 402
        : result.reason === "not_configured"
          ? 503
          : 500;
    return NextResponse.json({ ...result, usage }, { status });
  }

  return NextResponse.json({ ...result, usage });
}
