import { NextRequest, NextResponse } from "next/server";
import {
  assertAiBudgetAvailable,
  chargeAiBudget,
} from "@/lib/aiBudgetAccount";
import { isAtAiCap } from "@/lib/aiUsage";
import { deepinfraKey } from "@/lib/config";
import { transcribeAudio } from "@/lib/deepinfra";
import { recordAiSpend } from "@/lib/aiSpend";
import { resolveProjectAccess } from "@/lib/projectAccess";
import { getCurrentUser } from "@/lib/session";

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

/**
 * POST /api/ai/transcribe
 * Whisper turbo STT for builder chat, interview, and landing idea input.
 */
export async function POST(req: NextRequest) {
  if (!deepinfraKey()) {
    return NextResponse.json(
      { ok: false, message: "Voice input is not configured yet." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    audioBase64?: string;
    audioMimeType?: string;
    projectId?: string;
  } | null;

  if (!body?.audioBase64) {
    return NextResponse.json(
      { ok: false, message: "No audio received." },
      { status: 400 }
    );
  }

  const buf = Buffer.from(body.audioBase64, "base64");
  if (buf.length < 200) {
    return NextResponse.json({
      ok: false,
      message: "Didn't catch that — try again.",
    });
  }
  if (buf.length > MAX_AUDIO_BYTES) {
    return NextResponse.json({
      ok: false,
      message: "Recording too long — try a shorter clip.",
    });
  }

  const projectId = body.projectId?.trim();

  if (projectId) {
    const access = await resolveProjectAccess(projectId);
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, message: "Could not verify project access." },
        { status: 403 }
      );
    }
    const budget = await assertAiBudgetAvailable(access.project, access.isGuest);
    if (!budget.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: "You've used your free AI allowance.",
          reason: "cap_reached",
        },
        { status: 402 }
      );
    }
  } else {
    const user = await getCurrentUser();
    if (user && isAtAiCap(user.aiUsageUsd)) {
      return NextResponse.json(
        {
          ok: false,
          message: "You've used your free AI allowance.",
          reason: "cap_reached",
        },
        { status: 402 }
      );
    }
  }

  try {
    const ext =
      body.audioMimeType?.includes("mp4") || body.audioMimeType?.includes("m4a")
        ? "m4a"
        : body.audioMimeType?.includes("mpeg")
          ? "mp3"
          : "webm";

    const result = await transcribeAudio({
      audio: buf,
      mimeType: body.audioMimeType ?? "audio/webm",
      filename: `recording.${ext}`,
    });

    if (!result.text) {
      return NextResponse.json({
        ok: false,
        message: "Didn't catch that — try again.",
      });
    }

    if (projectId) {
      const access = await resolveProjectAccess(projectId);
      if (access.ok) {
        await chargeAiBudget({
          projectId,
          ownerUserId: access.project.userId,
          isGuest: access.isGuest,
          costUsd: result.costUsd,
        });
      }
    } else {
      const user = await getCurrentUser();
      if (user) {
        await recordAiSpend(user.id, result.costUsd);
      }
    }

    return NextResponse.json({ ok: true, text: result.text });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Could not transcribe — try again." },
      { status: 500 }
    );
  }
}
