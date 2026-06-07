/**
 * Kimi / plan-model chat — shared by interview + master prompt.
 * Kimi K2.6 needs thinking disabled + enough max_tokens or content comes back empty.
 */
import { integrations, planModel } from "@/lib/config";
import { trackLlmCost } from "@/lib/aiBillingContext";
import { parseDeepInfraCost, type AiChatResult } from "@/lib/deepinfraCost";

export type PlanChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function isKimiModel(name?: string): boolean {
  return (name ?? "").toLowerCase().includes("kimi");
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

/** Call Kimi (plan model). Never uses json mode — parse JSON from plain text if needed. */
export async function planChatComplete(
  messages: PlanChatMessage[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  } = {}
): Promise<AiChatResult> {
  if (!integrations.planModel || !planModel.baseUrl || !planModel.key) {
    return { text: "", costUsd: 0 };
  }

  const kimi = isKimiModel(planModel.name);
  const maxTokens = opts.maxTokens ?? (kimi ? 1024 : 512);
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const url = `${planModel.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const body: Record<string, unknown> = {
    model: planModel.name,
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
        Authorization: `Bearer ${planModel.key}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(
        `[planChatComplete] ${res.status} model=${planModel.name}`,
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
        `[planChatComplete] empty content model=${planModel.name} finish=${finish}`
      );
    }
    return { text, costUsd };
  }

  try {
    if (kimi) {
      body.thinking = { type: "disabled" };
    }

    let result = await call(body);
    if (!result.text && kimi && body.thinking) {
      const retry = { ...body, thinking: undefined, max_tokens: Math.max(maxTokens, 2048) };
      result = await call(retry);
    }
    return result;
  } catch (err) {
    console.error("[planChatComplete] failed:", err);
    return { text: "", costUsd: 0 };
  } finally {
    clearTimeout(timer);
  }
}
