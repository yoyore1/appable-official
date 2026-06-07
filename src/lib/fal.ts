/**
 * fal.ai Seedance 2.0 — launch-pack ad video only (not free in-app).
 */
import { falConfig } from "@/lib/config";

const QUEUE_BASE = "https://queue.fal.run";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export type SeedanceInput = {
  prompt: string;
  imageUrl: string;
  endImageUrl?: string;
  resolution?: "480p" | "720p" | "1080p";
  duration?: "auto" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "11" | "12" | "13" | "14" | "15";
  aspectRatio?: "auto" | "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
  generateAudio?: boolean;
};

export type SeedanceResult = {
  videoUrl: string;
  seed?: number;
  requestId: string;
};

/**
 * Submit + poll fal queue until the video is ready.
 * Model: bytedance/seedance-2.0/image-to-video
 */
export async function generateSeedanceVideo(
  input: SeedanceInput,
  opts?: { maxWaitMs?: number; pollMs?: number }
): Promise<SeedanceResult> {
  const key = falConfig.key;
  if (!key) throw new Error("FAL_NOT_CONFIGURED");

  const modelId = falConfig.seedanceModel;
  const headers = {
    Authorization: `Key ${key}`,
    "Content-Type": "application/json",
  };

  const submitRes = await fetch(`${QUEUE_BASE}/${modelId}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: input.prompt,
      image_url: input.imageUrl,
      ...(input.endImageUrl ? { end_image_url: input.endImageUrl } : {}),
      resolution: input.resolution ?? "720p",
      duration: input.duration ?? "auto",
      aspect_ratio: input.aspectRatio ?? "9:16",
      generate_audio: input.generateAudio ?? true,
    }),
  });

  if (!submitRes.ok) {
    const err = await submitRes.text().catch(() => "");
    throw new Error(`fal submit ${submitRes.status}: ${err.slice(0, 200)}`);
  }

  const submitted = (await submitRes.json()) as { request_id?: string };
  const requestId = submitted.request_id;
  if (!requestId) throw new Error("fal: missing request_id");

  const deadline = Date.now() + (opts?.maxWaitMs ?? 180_000);
  const pollMs = opts?.pollMs ?? 2500;

  while (Date.now() < deadline) {
    const statusRes = await fetch(
      `${QUEUE_BASE}/${modelId}/requests/${requestId}/status`,
      { headers: { Authorization: `Key ${key}` } }
    );
    if (!statusRes.ok) {
      await sleep(pollMs);
      continue;
    }

    const status = (await statusRes.json()) as { status?: string };
    if (status.status === "COMPLETED") {
      const resultRes = await fetch(
        `${QUEUE_BASE}/${modelId}/requests/${requestId}`,
        { headers: { Authorization: `Key ${key}` } }
      );
      if (!resultRes.ok) throw new Error(`fal result ${resultRes.status}`);
      const result = (await resultRes.json()) as {
        video?: { url?: string };
        seed?: number;
      };
      const videoUrl = result?.video?.url;
      if (!videoUrl) throw new Error("fal: no video url in result");
      return { videoUrl, seed: result.seed, requestId };
    }

    if (status.status === "FAILED") {
      throw new Error("fal: video generation failed");
    }

    await sleep(pollMs);
  }

  throw new Error("fal: timed out waiting for video");
}
