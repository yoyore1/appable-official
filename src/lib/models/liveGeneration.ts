/**
 * Capped live AI generations inside built apps (photo→recipe, etc.).
 * Routes through DeepInfra + fal per the models-polish spec.
 */
import { recordAiSpend } from "@/lib/aiSpend";
import {
  canSpend,
  ESTIMATED_COST_USD,
  publicUsageSnapshot,
  usageSnapshot,
} from "@/lib/aiUsage";
import { trackLlmCost } from "@/lib/aiBillingContext";
import {
  embedText,
  generateImage,
  rerankDocuments,
  synthesizeSpeech,
  transcribeAudio,
  visionComplete,
} from "@/lib/deepinfra";
import { generateSeedanceVideo } from "@/lib/fal";
import {
  classifyComplexity,
  endpointForTask,
  routeModelForCapability,
  isTaskConfigured,
  shouldUseOpenRouter,
} from "@/lib/models/router";
import type { ComplexityTier, ModelTask } from "@/lib/models/router";
import { openRouterChatComplete } from "@/lib/openrouter";
import type { UserAccount } from "@/lib/types";

export type LiveGenerationInput = {
  text?: string;
  imageUrl?: string;
  audioBase64?: string;
  audioMimeType?: string;
  documents?: string[];
  seedanceImageUrl?: string;
};

export type LiveGenerationResult =
  | {
      ok: true;
      task: ModelTask;
      costUsd: number;
      output: string;
      audioUrl?: string;
      videoUrl?: string;
      embeddings?: number[][];
      rankings?: { index: number; score: number; text: string }[];
    }
  | { ok: false; reason: "cap_reached" | "not_configured" | "error"; message: string };

export function checkLiveGenerationBudget(
  user: Pick<UserAccount, "aiUsageUsd" | "ttsCharsUsed">,
  capability: string,
  input: LiveGenerationInput = {}
): LiveGenerationResult | { ok: true; task: ModelTask; complexity: ComplexityTier } {
  const task = routeModelForCapability(capability);
  const complexity = classifyComplexity(capability, { text: input.text });
  if (!isTaskConfigured(task, complexity)) {
    return {
      ok: false,
      reason: "not_configured",
      message:
        "Add DEEPINFRA_API_KEY (and OPENROUTER_API_KEY for premium tasks, FAL_KEY for video) to .env.local.",
    };
  }
  if (
    !canSpend(user.aiUsageUsd, task, {
      ttsChars: task === "text_to_speech" ? 200 : undefined,
      ttsCharsUsed: user.ttsCharsUsed,
    })
  ) {
    return {
      ok: false,
      reason: "cap_reached",
      message:
        "You've used your free AI generations. Connect your own API key to keep going.",
    };
  }
  return { ok: true, task, complexity };
}

async function dispatchTask(
  task: ModelTask,
  capability: string,
  input: LiveGenerationInput,
  complexity: ComplexityTier = "simple"
): Promise<{
  output: string;
  costUsd: number;
  ttsChars?: number;
  audioUrl?: string;
  videoUrl?: string;
  embeddings?: number[][];
  rankings?: { index: number; score: number; text: string }[];
}> {
  switch (task) {
    case "vision": {
      if (!input.imageUrl) throw new Error("imageUrl required for vision");
      if (shouldUseOpenRouter(task, complexity)) {
        const endpoint = endpointForTask(task, complexity);
        const { text, costUsd } = await openRouterChatComplete(
          [
            {
              role: "user",
              content: [
                { type: "text", text: input.text ?? capability },
                { type: "image_url", image_url: { url: input.imageUrl } },
              ],
            },
          ],
          { model: endpoint.name, maxTokens: 1024 }
        );
        if (!text) throw new Error("Vision model returned no text");
        return { output: text, costUsd };
      }
      const vision = await visionComplete({
        imageUrl: input.imageUrl,
        prompt: input.text ?? capability,
      });
      return { output: vision.text, costUsd: vision.costUsd };
    }
    case "image_gen": {
      const prompt = input.text ?? capability;
      const images = await generateImage({ prompt, n: 1 });
      const first = images[0];
      if (!first) throw new Error("No image returned");
      return {
        output: first.dataUrl,
        costUsd: first.costUsd,
      };
    }
    case "speech_to_text": {
      if (!input.audioBase64) throw new Error("audioBase64 required for STT");
      const buf = Buffer.from(input.audioBase64, "base64");
      const stt = await transcribeAudio({
        audio: buf,
        mimeType: input.audioMimeType ?? "audio/mpeg",
      });
      return { output: stt.text, costUsd: stt.costUsd };
    }
    case "text_to_speech": {
      const text = input.text ?? capability;
      const tts = await synthesizeSpeech(text);
      return {
        output: tts.audioBase64 ?? tts.audioUrl ?? "Audio generated.",
        costUsd: tts.costUsd,
        ttsChars: tts.chars,
        audioUrl: tts.audioUrl ?? tts.audioBase64,
      };
    }
    case "embedding": {
      const text = input.text ?? capability;
      const embedded = await embedText(text);
      return {
        output: `Embedded ${embedded.embeddings.length} vector(s), dim ${embedded.embeddings[0]?.length ?? 0}.`,
        costUsd: embedded.costUsd,
        embeddings: embedded.embeddings,
      };
    }
    case "rerank": {
      const query = input.text ?? capability;
      const docs = input.documents ?? [];
      if (!docs.length) throw new Error("documents required for rerank");
      const ranked = await rerankDocuments(query, docs);
      return {
        output: ranked.rankings[0]?.text ?? "",
        costUsd: ranked.costUsd,
        rankings: ranked.rankings,
      };
    }
    case "ad_video": {
      if (!input.seedanceImageUrl) throw new Error("seedanceImageUrl required");
      const video = await generateSeedanceVideo({
        prompt: input.text ?? capability,
        imageUrl: input.seedanceImageUrl,
        aspectRatio: "9:16",
        duration: "12",
      });
      const costUsd = ESTIMATED_COST_USD.ad_video ?? 0.33;
      trackLlmCost(costUsd);
      return {
        output: video.videoUrl,
        videoUrl: video.videoUrl,
        costUsd,
      };
    }
    default:
      throw new Error(`Task ${task} not supported for live generation yet`);
  }
}

export async function runLiveGeneration(
  user: Pick<UserAccount, "id" | "aiUsageUsd" | "ttsCharsUsed">,
  capability: string,
  input: LiveGenerationInput = {}
): Promise<LiveGenerationResult> {
  const gate = checkLiveGenerationBudget(user, capability, input);
  if (!("complexity" in gate)) return gate;

  try {
    const result = await dispatchTask(gate.task, capability, input, gate.complexity);
    if (result.costUsd > 0) {
      await recordAiSpend(user.id, result.costUsd, result.ttsChars ?? 0);
    }
    return {
      ok: true,
      task: gate.task,
      costUsd: result.costUsd,
      output: result.output,
      audioUrl: result.audioUrl,
      videoUrl: result.videoUrl,
      embeddings: result.embeddings,
      rankings: result.rankings,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    return { ok: false, reason: "error", message: msg };
  }
}

export function userAiSnapshot(user: Pick<UserAccount, "aiUsageUsd" | "ttsCharsUsed">) {
  return usageSnapshot(user.aiUsageUsd, user.ttsCharsUsed);
}

/** Client-safe budget — percentages only. */
export function userPublicAiUsage(user: Pick<UserAccount, "aiUsageUsd">) {
  return publicUsageSnapshot(user.aiUsageUsd);
}
