/**
 * DeepInfra OpenAI-compatible + inference HTTP clients.
 * One API key (DEEPINFRA_API_KEY) powers vision, images, STT, TTS, embeddings, rerank.
 */
import {
  deepinfra,
  deepinfraKey,
  embeddingModel,
  imageGenModel,
  rerankerModel,
  speechToTextModel,
  textToSpeechModel,
  visionModel,
} from "@/lib/config";

const OPENAI_BASE = deepinfra.openaiBase;
const INFERENCE_BASE = deepinfra.inferenceBase;

function key(): string | undefined {
  return deepinfraKey();
}

function authHeaders(k: string, json = true): HeadersInit {
  return {
    Authorization: `Bearer ${k}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

export type VisionInput = {
  imageUrl: string;
  prompt?: string;
  maxTokens?: number;
};

/** Qwen3-VL — photo understanding, OCR (pass image URL or data URI). */
export async function visionComplete(input: VisionInput): Promise<string> {
  const k = key();
  if (!k) throw new Error("DEEPINFRA_NOT_CONFIGURED");

  const prompt =
    input.prompt ??
    "Describe what you see. If there is text in the image, transcribe it accurately.";

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: authHeaders(k),
    body: JSON.stringify({
      model: visionModel.name,
      max_tokens: input.maxTokens ?? 2048,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: input.imageUrl } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`vision ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data?.choices?.[0]?.message?.content ?? "").trim();
}

export type ImageGenInput = {
  prompt: string;
  size?: "1024x1024" | "512x512";
  n?: number;
};

/** FLUX-2-klein-4b — returns base64 JPEG/PNG data URLs. */
export async function generateImage(
  input: ImageGenInput
): Promise<{ dataUrl: string; revisedPrompt?: string }[]> {
  const k = key();
  if (!k) throw new Error("DEEPINFRA_NOT_CONFIGURED");

  const res = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: "POST",
    headers: authHeaders(k),
    body: JSON.stringify({
      model: imageGenModel.name,
      prompt: input.prompt,
      size: input.size ?? "1024x1024",
      n: input.n ?? 1,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`image_gen ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const items = (data?.data ?? []) as { b64_json?: string; revised_prompt?: string }[];
  return items
    .filter((d) => d.b64_json)
    .map((d) => ({
      dataUrl: `data:image/png;base64,${d.b64_json}`,
      revisedPrompt: d.revised_prompt,
    }));
}

export type TranscribeInput = {
  audio: Buffer | Uint8Array;
  filename?: string;
  mimeType?: string;
  language?: string;
};

/** Whisper large v3 turbo — multipart transcription. */
export async function transcribeAudio(input: TranscribeInput): Promise<string> {
  const k = key();
  if (!k) throw new Error("DEEPINFRA_NOT_CONFIGURED");

  const form = new FormData();
  const bytes = Uint8Array.from(input.audio);
  const blob = new Blob([bytes], {
    type: input.mimeType ?? "audio/mpeg",
  });
  form.append("file", blob, input.filename ?? "audio.mp3");
  form.append("model", speechToTextModel.name);
  if (input.language) form.append("language", input.language);

  const res = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${k}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`stt ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data?.text ?? "").trim();
}

/** Qwen3-TTS — DeepInfra inference endpoint (not OpenAI-shaped). */
export async function synthesizeSpeech(text: string): Promise<{
  audioUrl?: string;
  audioBase64?: string;
  chars: number;
  costUsd?: number;
}> {
  const k = key();
  if (!k) throw new Error("DEEPINFRA_NOT_CONFIGURED");

  const model = textToSpeechModel.name ?? "Qwen/Qwen3-TTS";
  const res = await fetch(`${INFERENCE_BASE}/${model}`, {
    method: "POST",
    headers: authHeaders(k),
    body: JSON.stringify({ input: text }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`tts ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const audio = data?.audio as string | null | undefined;
  const cost = data?.inference_status?.cost as number | undefined;

  if (audio && typeof audio === "string") {
    const dataUrl = audio.startsWith("data:") || audio.startsWith("http")
      ? audio
      : `data:audio/wav;base64,${audio}`;
    return {
      audioUrl: dataUrl.startsWith("http") ? dataUrl : undefined,
      audioBase64: dataUrl.startsWith("data:") ? dataUrl : undefined,
      chars: text.length,
      costUsd: cost,
    };
  }

  return { chars: text.length, costUsd: cost };
}

/** Qwen3-Embedding — OpenAI embeddings API. */
export async function embedText(
  input: string | string[]
): Promise<number[][]> {
  const k = key();
  if (!k) throw new Error("DEEPINFRA_NOT_CONFIGURED");

  const res = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: "POST",
    headers: authHeaders(k),
    body: JSON.stringify({
      input,
      model: embeddingModel.name,
      encoding_format: "float",
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`embed ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const rows = (data?.data ?? []) as { embedding: number[] }[];
  return rows.map((r) => r.embedding);
}

/** Qwen3-Reranker — inference endpoint. */
export async function rerankDocuments(
  query: string,
  documents: string[]
): Promise<{ index: number; score: number; text: string }[]> {
  const k = key();
  if (!k) throw new Error("DEEPINFRA_NOT_CONFIGURED");

  const model = rerankerModel.name ?? "Qwen/Qwen3-Reranker-0.6B";
  const res = await fetch(`${INFERENCE_BASE}/${model}`, {
    method: "POST",
    headers: authHeaders(k),
    body: JSON.stringify({ queries: [query], documents }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`rerank ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const scores = (data?.scores ?? []) as number[];
  return scores
    .map((score, index) => ({ index, score, text: documents[index] ?? "" }))
    .sort((a, b) => b.score - a.score);
}
