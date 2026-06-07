/**
 * Model router — picks the cheapest DeepInfra / fal model for each task.
 * Env vars wire in when the user provides API keys; mock mode skips paid calls.
 */
import {
  adVideoModel,
  appCodeModel,
  cheapTextModel,
  embeddingModel,
  imageGenModel,
  integrations,
  rerankerModel,
  speechToTextModel,
  textToSpeechModel,
  visionModel,
} from "@/lib/config";

export type ModelTask =
  | "app_code"
  | "cheap_text"
  | "vision"
  | "image_gen"
  | "speech_to_text"
  | "text_to_speech"
  | "embedding"
  | "rerank"
  | "ad_video";

export interface ModelEndpoint {
  baseUrl?: string;
  key?: string;
  name?: string;
  /** Rough $ per 1M input tokens (or per-image where applicable). */
  costHint?: string;
}

const TASK_ENDPOINT: Record<ModelTask, () => ModelEndpoint> = {
  app_code: () => appCodeModel,
  cheap_text: () => cheapTextModel,
  vision: () => visionModel,
  image_gen: () => imageGenModel,
  speech_to_text: () => speechToTextModel,
  text_to_speech: () => textToSpeechModel,
  embedding: () => embeddingModel,
  rerank: () => rerankerModel,
  ad_video: () => adVideoModel,
};

/** Resolve the endpoint for a routed task. */
export function endpointForTask(task: ModelTask): ModelEndpoint {
  return TASK_ENDPOINT[task]();
}

/** True when this task has credentials configured. */
export function isTaskConfigured(task: ModelTask): boolean {
  const map: Record<ModelTask, boolean> = {
    app_code: integrations.appCodeModel,
    cheap_text: integrations.cheapTextModel,
    vision: integrations.visionModel,
    image_gen: integrations.imageGenModel,
    speech_to_text: integrations.speechToTextModel,
    text_to_speech: integrations.textToSpeechModel,
    embedding: integrations.embeddingModel,
    rerank: integrations.rerankerModel,
    ad_video: integrations.adVideoModel,
  };
  return map[task];
}

/**
 * Route an in-app capability to the right model.
 * text→Kimi; cheap text→Step Flash; photo→Qwen3-VL; makes image→FLUX; etc.
 */
export function routeModelForCapability(capability: string): ModelTask {
  const c = capability.toLowerCase();
  if (/photo|camera|scan|image|see|vision|ocr|identify|recognize/.test(c)) {
    return "vision";
  }
  if (/generate image|avatar|art|flux|draw|design asset/.test(c)) {
    return "image_gen";
  }
  if (/voice in|transcribe|whisper|speech to text|dictat/.test(c)) {
    return "speech_to_text";
  }
  if (/tts|speak|read aloud|audio out|talk back/.test(c)) {
    return "text_to_speech";
  }
  if (/embed|semantic search|recommend/.test(c)) {
    return "embedding";
  }
  if (/rerank|search rank/.test(c)) {
    return "rerank";
  }
  if (/video ad|seedance|launch ad/.test(c)) {
    return "ad_video";
  }
  if (/chat|summary|legal|aso|interview|fix|short/.test(c)) {
    return "cheap_text";
  }
  return "app_code";
}
