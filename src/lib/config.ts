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
  /** Kimi (or other strong model) for master-plan synthesis — separate from cheap chat. */
  planModel: Boolean(
    (env("BUILD_MODEL_BASE_URL") && env("BUILD_MODEL_KEY")) ||
      (env("CHAT_MODEL_BASE_URL") && env("CHAT_MODEL_KEY"))
  ),
  imageModel: Boolean(env("IMAGE_MODEL_BASE_URL") && env("IMAGE_MODEL_KEY")),
  videoModel: Boolean(env("VIDEO_API_KEY")),
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

export const chatModel = {
  baseUrl: env("CHAT_MODEL_BASE_URL"),
  key: env("CHAT_MODEL_KEY"),
  name: env("CHAT_MODEL_NAME") ?? "step-3.5-flash",
};

/** Final interview → master build prompt. Defaults to Kimi K2.6 via DeepInfra. */
export const planModel = {
  baseUrl: env("BUILD_MODEL_BASE_URL") ?? env("CHAT_MODEL_BASE_URL"),
  key: env("BUILD_MODEL_KEY") ?? env("CHAT_MODEL_KEY"),
  name: env("BUILD_MODEL_NAME") ?? "moonshotai/Kimi-K2.6",
};

export const imageModel = {
  baseUrl: env("IMAGE_MODEL_BASE_URL"),
  key: env("IMAGE_MODEL_KEY"),
  name: env("IMAGE_MODEL_NAME") ?? "gpt-image-2",
};

export const videoModel = {
  baseUrl: env("VIDEO_API_BASE_URL"),
  key: env("VIDEO_API_KEY"),
};

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

/** The 5-question interview. Colors uses dynamic palette chips from interviewHelpers. */
export const interviewQuestions = [
  { id: "idea", prompt: "Tell me about your app — what's the idea?", kind: "text" as const },
  { id: "audience", prompt: "Who's it for?", kind: "text" as const },
  { id: "features", prompt: "What are the 3 main things it does?", kind: "text" as const },
  {
    id: "name",
    prompt: "What do you want to call it? (Or say \"suggest one\" and I'll name it.)",
    kind: "text" as const,
  },
  {
    id: "colors",
    prompt: "Last one — pick a palette that feels right, or tap Surprise me:",
    kind: "choice" as const,
    options: [] as string[],
  },
] as const;
