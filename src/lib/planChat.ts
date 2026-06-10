/**
 * Plan-model chat (DeepInfra Kimi) — master prompt + initial expo generate.
 * Expo Build tab uses buildChatComplete → Fireworks Kimi K2.6 (expoBuildModel).
 */
import { integrations, expoBuildModel, planModel } from "@/lib/config";
import { trackLlmCost } from "@/lib/aiBillingContext";
import { parseDeepInfraCost, type AiChatResult } from "@/lib/deepinfraCost";

export type PlanChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ModelConfig = { baseUrl?: string; key?: string; name?: string };

function isKimiModel(name?: string): boolean {
  return (name ?? "").toLowerCase().includes("kimi");
}

function kimiThinkingDisabled(model: ModelConfig): boolean {
  return (
    isKimiModel(model.name) &&
    (model.baseUrl ?? "").toLowerCase().includes("deepinfra")
  );
}

function extractAssistantText(data: unknown): string {
  const choice = (
    data as {
      choices?: Array<{
        message?: { content?: unknown };
        text?: string;
        finish_reason?: string;
      }>;
    }
  )?.choices?.[0];
  const msg = choice?.message;
  const raw = msg?.content ?? choice?.text ?? "";
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: string }).text ?? "");
        }
        return "";
      })
      .join("")
      .trim();
  }
  return "";
}

async function chatCompleteWithModel(
  messages: PlanChatMessage[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  },
  model: ModelConfig,
  logTag: string
): Promise<AiChatResult> {
  if (!model.baseUrl || !model.key) {
    return { text: "", costUsd: 0 };
  }

  const kimi = isKimiModel(model.name);
  const maxTokens = opts.maxTokens ?? (kimi ? 1024 : 512);
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const url = `${model.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const body: Record<string, unknown> = {
    model: model.name,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: maxTokens,
  };

  async function call(payload: Record<string, unknown>): Promise<AiChatResult> {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${model.key}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(
        `[${logTag}] ${res.status} model=${model.name}`,
        errBody.slice(0, 400)
      );
      return { text: "", costUsd: 0 };
    }

    const data = await res.json();
    const costUsd = parseDeepInfraCost(data);
    trackLlmCost(costUsd);
    const text = extractAssistantText(data);
    if (!text) {
      const finish = (
        data as { choices?: Array<{ finish_reason?: string }> }
      )?.choices?.[0]?.finish_reason;
      console.error(
        `[${logTag}] empty content model=${model.name} finish=${finish}`
      );
    }
    return { text, costUsd };
  }

  try {
    if (kimiThinkingDisabled(model)) {
      body.thinking = { type: "disabled" };
    }

    let result = await call(body);
    if (!result.text && body.thinking) {
      const retry = {
        ...body,
        thinking: undefined,
        max_tokens: Math.max(maxTokens, 2048),
      };
      result = await call(retry);
    }
    return result;
  } catch (err) {
    console.error(`[${logTag}] failed:`, err);
    return { text: "", costUsd: 0 };
  } finally {
    clearTimeout(timer);
  }
}

/** DeepInfra Kimi — master prompt synthesis + initial expo generate only. */
export async function planChatComplete(
  messages: PlanChatMessage[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  } = {}
): Promise<AiChatResult> {
  if (!integrations.planModel) {
    return { text: "", costUsd: 0 };
  }
  return chatCompleteWithModel(messages, opts, planModel, "planChatComplete");
}

/** Expo Build + deep Brainstorm — Fireworks Kimi K2.6. Interview / shallow chat use Qwen. */
export async function buildChatComplete(
  messages: PlanChatMessage[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  } = {}
): Promise<AiChatResult> {
  if (!integrations.expoBuildModel) {
    return { text: "", costUsd: 0 };
  }
  return chatCompleteWithModel(
    messages,
    opts,
    expoBuildModel,
    "buildChatComplete"
  );
}

/** Code agent — Fireworks Kimi; initial build may fall back to plan model. */
export async function codeAgentChatComplete(
  messages: PlanChatMessage[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    /** Initial scaffold pass — allow plan model when Fireworks is absent. */
    allowPlanFallback?: boolean;
  } = {}
): Promise<AiChatResult> {
  if (integrations.expoBuildModel) {
    return chatCompleteWithModel(
      messages,
      opts,
      expoBuildModel,
      "codeAgentChatComplete"
    );
  }
  if (opts.allowPlanFallback && integrations.planModel) {
    return chatCompleteWithModel(
      messages,
      opts,
      planModel,
      "codeAgentChatCompletePlanFallback"
    );
  }
  return { text: "", costUsd: 0 };
}
