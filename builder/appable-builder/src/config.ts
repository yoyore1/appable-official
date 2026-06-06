/**
 * Builder engine config. Loads .env.local / .env (zero-dependency parser),
 * exposes models, platform connection, budgets, and caps. Anything missing
 * → MOCK MODE for that subsystem.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

function env(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim() !== "" ? v.trim() : undefined;
}
function num(key: string, fallback: number): number {
  const v = env(key);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const buildModel = {
  baseUrl: env("BUILD_MODEL_BASE_URL"),
  key: env("BUILD_MODEL_KEY"),
  name: env("BUILD_MODEL_NAME") ?? "moonshotai/Kimi-K2.6",
};

export const chatModel = {
  baseUrl: env("CHAT_MODEL_BASE_URL"),
  key: env("CHAT_MODEL_KEY"),
  name: env("CHAT_MODEL_NAME") ?? "step-3.5-flash",
};

export const platform = {
  url: env("APPABLE_API_URL"),
  key: env("APPABLE_API_KEY") ?? "dev-service-key",
};

export const budgets = {
  base: num("BASE_BUILD_BUDGET", 40000),
  full: num("FULL_BUILD_BUDGET", 200000),
  errorFixMaxRounds: num("ERROR_FIX_MAX_ROUNDS", 6),
  buildReviewSplit: num("BUILD_REVIEW_SPLIT", 0.8),
};

export const outputDir = env("APPABLE_OUTPUT_DIR") ?? "./builds";

export const integrations = {
  buildModel: Boolean(buildModel.baseUrl && buildModel.key),
  chatModel: Boolean(chatModel.baseUrl && chatModel.key),
  platform: Boolean(platform.url),
};
