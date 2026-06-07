/**
 * Interview chat model — DeepInfra OpenAI /chat/completions (Qwen 3.6 default).
 */
import { chatModel, integrations } from "@/lib/config";
import { trackLlmCost } from "@/lib/aiBillingContext";
import { parseDeepInfraCost, type AiChatResult } from "@/lib/deepinfraCost";
import type { PlanChatMessage } from "@/lib/planChat";

function stripReasoning(text: string): string {
  let t = text.trim();
  const open = "\u003cthink\u003e";
  const close = "\u003c/think\u003e";
  while (t.includes(open)) {
    const start = t.indexOf(open);
    const end = t.indexOf(close, start + open.length);
    t =
      end >= 0
        ? (t.slice(0, start) + t.slice(end + close.length)).trim()
        : t.slice(0, start).trim();
  }
  return t;
}

function extractAssistantText(data: unknown): string {
  const choice = (
    data as {
      choices?: Array<{ message?: { content?: unknown }; text?: string }>;
    }
  )?.choices?.[0];
  const raw = choice?.message?.content ?? choice?.text ?? "";
  let text = "";
  if (typeof raw === "string") text = raw.trim();
  else if (Array.isArray(raw)) {
    text = raw
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
  return stripReasoning(text);
}

function isQwenModel(name?: string): boolean {
  return (name ?? "").toLowerCase().includes("qwen");
}

export async function flashChatComplete(
  messages: PlanChatMessage[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  } = {}
): Promise<AiChatResult> {
  if (!integrations.chatModel || !chatModel.baseUrl || !chatModel.key) {
    return { text: "", costUsd: 0 };
  }

  const qwen = isQwenModel(chatModel.name);
  const timeoutMs = opts.timeoutMs ?? (qwen ? 45_000 : 18_000);
  const maxTokens = opts.maxTokens ?? (qwen ? 512 : 384);
  const url = `${chatModel.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const body: Record<string, unknown> = {
    model: chatModel.name,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: maxTokens,
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chatModel.key}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(
        `[flashChatComplete] ${res.status} model=${chatModel.name}`,
        errBody.slice(0, 300)
      );
      return { text: "", costUsd: 0 };
    }

    const data = await res.json();
    const costUsd = parseDeepInfraCost(data);
    trackLlmCost(costUsd);
    return { text: extractAssistantText(data), costUsd };
  } catch (err) {
    console.error("[flashChatComplete] failed:", err);
    return { text: "", costUsd: 0 };
  } finally {
    clearTimeout(timer);
  }
}
