/**
 * Model router — DeepInfra for bulk traffic; OpenRouter for premium escalation.
 * See docs/appable-ai-integration.md for the full decision tree.
 */
import {
  adVideoModel,
  appCodeModel,
  cheapTextModel,
  embeddingModel,
  imageGenModel,
  integrations,
  openrouterConfig,
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

export type ComplexityTier = "simple" | "mid" | "complex";

export type ModelProvider = "deepinfra" | "openrouter";

export interface ModelEndpoint {
  baseUrl?: string;
  key?: string;
  name?: string;
  provider?: ModelProvider;
  /** Rough $ per 1M input tokens (or per-image where applicable). */
  costHint?: string;
}

const TASK_ENDPOINT: Record<ModelTask, () => ModelEndpoint> = {
  app_code: () => ({ ...appCodeModel, provider: "deepinfra" }),
  cheap_text: () => ({ ...cheapTextModel, provider: "deepinfra" }),
  vision: () => ({ ...visionModel, provider: "deepinfra" }),
  image_gen: () => ({ ...imageGenModel, provider: "deepinfra" }),
  speech_to_text: () => ({ ...speechToTextModel, provider: "deepinfra" }),
  text_to_speech: () => ({ ...textToSpeechModel, provider: "deepinfra" }),
  embedding: () => ({ ...embeddingModel, provider: "deepinfra" }),
  rerank: () => ({ ...rerankerModel, provider: "deepinfra" }),
  ad_video: () => ({ ...adVideoModel, provider: "deepinfra" }),
};

/** Heuristic complexity — complex tasks may escalate to OpenRouter. */
export function classifyComplexity(
  capability: string,
  extra?: { text?: string }
): ComplexityTier {
  const blob = `${capability} ${extra?.text ?? ""}`.toLowerCase();

  if (
    /complex|frontier|best quality|highest quality|deep analysis|multi.?step|chain of thought|legal review|medical|proofread|critique|agent|reasoning/.test(
      blob
    )
  ) {
    return "complex";
  }
  if (
    /detailed|summar|classif|extract|moderat|compare|plan|strategy|personalized/.test(
      blob
    )
  ) {
    return "mid";
  }
  return "simple";
}

/** Whether this task + complexity should use OpenRouter (when configured). */
export function shouldUseOpenRouter(task: ModelTask, complexity: ComplexityTier): boolean {
  if (!integrations.openrouter) return false;
  if (complexity !== "complex") return false;

  switch (task) {
    case "app_code":
    case "cheap_text":
    case "vision":
    case "image_gen":
      return true;
    default:
      return false;
  }
}

export function openRouterModelForTask(task: ModelTask): string {
  switch (task) {
    case "vision":
      return openrouterConfig.models.vision;
    case "image_gen":
      return openrouterConfig.models.image;
    case "app_code":
      return openrouterConfig.models.reasoning;
    case "cheap_text":
    default:
      return openrouterConfig.models.text;
  }
}

/** Resolve routed endpoint — may point at OpenRouter for complex premium work. */
export function endpointForTask(
  task: ModelTask,
  complexity: ComplexityTier = "simple"
): ModelEndpoint {
  if (shouldUseOpenRouter(task, complexity)) {
    return {
      baseUrl: openrouterConfig.baseUrl,
      key: openrouterConfig.key,
      name: openRouterModelForTask(task),
      provider: "openrouter",
    };
  }
  return TASK_ENDPOINT[task]();
}

/** True when this task has credentials configured (DeepInfra or OpenRouter path). */
export function isTaskConfigured(
  task: ModelTask,
  complexity: ComplexityTier = "simple"
): boolean {
  if (shouldUseOpenRouter(task, complexity)) return true;

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
 * Route an in-app capability to the right model task.
 * text→Kimi; cheap text→Qwen; photo→Qwen3-VL; makes image→FLUX; etc.
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
