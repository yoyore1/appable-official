/**
 * Central config for the Appable platform.
 *
 * Pricing, "build power" amounts, and model settings live here so they're easy
 * to tune. Anything secret is read from env; when a service's env vars are
 * absent the app falls back to MOCK MODE for that service (see the `mock` flags)
 * so the whole product runs locally with zero external accounts.
 */

function env(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function num(key: string, fallback: number): number {
  const v = env(key);
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const appUrl = env("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
export const serviceKey = env("APPABLE_SERVICE_KEY") ?? "dev-service-key";

/** Shared DeepInfra key — one key routes to all DeepInfra models. */
export function deepinfraKey(): string | undefined {
  return (
    env("DEEPINFRA_API_KEY") ??
    env("VISION_MODEL_KEY") ??
    env("IMAGE_MODEL_KEY") ??
    env("STT_MODEL_KEY") ??
    env("TTS_MODEL_KEY") ??
    env("EMBED_MODEL_KEY") ??
    env("BUILD_MODEL_KEY") ??
    env("CHAT_MODEL_KEY")
  );
}

export const deepinfra = {
  openaiBase: env("DEEPINFRA_OPENAI_BASE") ?? "https://api.deepinfra.com/v1/openai",
  inferenceBase: env("DEEPINFRA_INFERENCE_BASE") ?? "https://api.deepinfra.com/v1/inference",
  key: deepinfraKey(),
};

export const falConfig = {
  key: env("FAL_KEY") ?? env("VIDEO_API_KEY"),
  seedanceModel:
    env("SEEDANCE_MODEL") ?? "bytedance/seedance-2.0/image-to-video",
};

/** Custom-protocol deep link the "Open in Appable Builder" button uses. */
export const builderProtocol = env("APPABLE_BUILDER_PROTOCOL") ?? "appable";

/** GitHub org integration — one private repo per app (invisible version control). */
export const github = {
  /** Backend org token (repo scope) used to auto-create repos. Mock when absent. */
  orgToken: env("GITHUB_ORG_TOKEN"),
  /** Org that owns all user app repos, e.g. "appable-apps". */
  org: env("GITHUB_ORG") ?? "appable-apps",
};

/** Which integrations are configured. If false → that subsystem runs in mock mode. */
export const integrations = {
  supabase: Boolean(
    env("NEXT_PUBLIC_SUPABASE_URL") && env("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  ),
  supabaseAdmin: Boolean(
    env("NEXT_PUBLIC_SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY")
  ),
  stripe: Boolean(env("STRIPE_SECRET_KEY")),
  chatModel: Boolean(env("CHAT_MODEL_BASE_URL") && env("CHAT_MODEL_KEY")),
  cheapTextModel: Boolean(env("CHAT_MODEL_BASE_URL") && env("CHAT_MODEL_KEY")),
  /** Kimi (or other strong model) for master-plan synthesis — separate from cheap chat. */
  planModel: Boolean(
    (env("BUILD_MODEL_BASE_URL") && env("BUILD_MODEL_KEY")) ||
      (env("CHAT_MODEL_BASE_URL") && env("CHAT_MODEL_KEY"))
  ),
  appCodeModel: Boolean(
    (env("BUILD_MODEL_BASE_URL") && env("BUILD_MODEL_KEY")) ||
      (env("CHAT_MODEL_BASE_URL") && env("CHAT_MODEL_KEY"))
  ),
  deepinfra: Boolean(deepinfraKey()),
  visionModel: Boolean(deepinfraKey()),
  imageModel: Boolean(deepinfraKey()),
  imageGenModel: Boolean(deepinfraKey()),
  speechToTextModel: Boolean(deepinfraKey()),
  textToSpeechModel: Boolean(deepinfraKey()),
  embeddingModel: Boolean(deepinfraKey()),
  rerankerModel: Boolean(deepinfraKey()),
  fal: Boolean(falConfig.key),
  videoModel: Boolean(falConfig.key),
  adVideoModel: Boolean(falConfig.key),
  /** Real GitHub org repo creation vs. mock repo URLs. */
  github: Boolean(env("GITHUB_ORG_TOKEN")),
};

export const supabaseConfig = {
  url: env("NEXT_PUBLIC_SUPABASE_URL"),
  anonKey: env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
};

export const stripeConfig = {
  secretKey: env("STRIPE_SECRET_KEY"),
  webhookSecret: env("STRIPE_WEBHOOK_SECRET"),
  publishableKey: env("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
};

export const cheapTextModel = {
  baseUrl: env("CHAT_MODEL_BASE_URL"),
  key: env("CHAT_MODEL_KEY"),
  name: env("CHAT_MODEL_NAME") ?? "Qwen/Qwen3.6-35B-A3B",
};

/** @deprecated alias */
export const chatModel = cheapTextModel;

/** Landing “Suggest ideas” — can use a smaller/faster model than interview chat. */
export const suggestIdeasModel = {
  baseUrl: env("SUGGEST_IDEAS_MODEL_BASE_URL") ?? cheapTextModel.baseUrl,
  key: env("SUGGEST_IDEAS_MODEL_KEY") ?? cheapTextModel.key,
  name:
    env("SUGGEST_IDEAS_MODEL_NAME") ??
    env("CHAT_MODEL_NAME") ??
    "Qwen/Qwen3-30B-A3B",
};

export const appCodeModel = {
  baseUrl: env("BUILD_MODEL_BASE_URL") ?? env("CHAT_MODEL_BASE_URL"),
  key: env("BUILD_MODEL_KEY") ?? env("CHAT_MODEL_KEY"),
  name: env("BUILD_MODEL_NAME") ?? "moonshotai/Kimi-K2.6",
};

export const planModel = appCodeModel;

export const visionModel = {
  baseUrl: deepinfra.openaiBase,
  key: deepinfra.key,
  name: env("VISION_MODEL_NAME") ?? "Qwen/Qwen3-VL-30B-A3B-Instruct",
};

export const imageModel = {
  baseUrl: deepinfra.openaiBase,
  key: deepinfra.key,
  name: env("IMAGE_MODEL_NAME") ?? "black-forest-labs/FLUX-2-klein-4b",
};

export const imageGenModel = imageModel;

export const speechToTextModel = {
  baseUrl: deepinfra.openaiBase,
  key: deepinfra.key,
  name: env("STT_MODEL_NAME") ?? "openai/whisper-large-v3-turbo",
};

export const textToSpeechModel = {
  baseUrl: deepinfra.inferenceBase,
  key: deepinfra.key,
  name: env("TTS_MODEL_NAME") ?? "Qwen/Qwen3-TTS",
};

export const embeddingModel = {
  baseUrl: deepinfra.openaiBase,
  key: deepinfra.key,
  name: env("EMBED_MODEL_NAME") ?? "Qwen/Qwen3-Embedding-0.6B",
};

export const rerankerModel = {
  baseUrl: deepinfra.inferenceBase,
  key: deepinfra.key,
  name: env("RERANK_MODEL_NAME") ?? "Qwen/Qwen3-Reranker-0.6B",
};

export const videoModel = {
  baseUrl: "https://queue.fal.run",
  key: falConfig.key,
  name: falConfig.seedanceModel,
};

export const adVideoModel = videoModel;

/** Plain-language unit shown to users is "build power", never "tokens". */
export const buildPower = {
  deposit: num("DEPOSIT_BUILD_POWER", 100),
  reviewTopup: num("REVIEW_TOPUP_AMOUNT", 50),
};

/** Money is in cents to avoid float issues. */
export const prices = {
  deposit: { id: "deposit", label: "$1 starter deposit", amount: 100, power: buildPower.deposit },
  packs: [
    { id: "pack_small", label: "Starter", amount: 1999, power: num("BUILD_POWER_PACK_SMALL", 1000) },
    { id: "pack_medium", label: "Maker", amount: 4999, power: num("BUILD_POWER_PACK_MEDIUM", 3000), popular: true },
    { id: "pack_large", label: "Founder", amount: 9999, power: num("BUILD_POWER_PACK_LARGE", 7000) },
  ],
  reviewTopup: { id: "review_topup", label: "Review top-up", amount: 199, review: buildPower.reviewTopup },
  launchPack: { id: "launch_pack", label: "Launch Pack", amount: 699 },
  launchAddons: {
    aso: { id: "aso", label: "ASO copy", amount: 299 },
    screenshots: { id: "screenshots", label: "App Store screenshots + icon", amount: 399 },
    video: { id: "video", label: "3 video ad scripts", amount: 399 },
  },
} as const;

/** Course subscription tiers (Stripe subscriptions). */
export const courseTiers = [
  {
    id: "course_starter",
    name: "Starter",
    amount: 4999,
    monthlyPower: 1000,
    launchPackIncluded: false,
    perks: ["All foundational lessons", "1,000 build power / month", "Community access"],
  },
  {
    id: "course_pro",
    name: "Pro",
    amount: 7999,
    monthlyPower: 3000,
    launchPackIncluded: true,
    popular: true,
    perks: ["Everything in Starter", "3,000 build power / month", "Launch Pack included", "Monthly group call"],
  },
  {
    id: "course_founder",
    name: "Founder",
    amount: 14999,
    monthlyPower: 7000,
    launchPackIncluded: true,
    perks: ["Everything in Pro", "7,000 build power / month", "Launch Pack included", "1-on-1 booking"],
  },
] as const;

/** Adaptive interview flow lives in `@/lib/interviewFlow` (reference branch + full path). */
