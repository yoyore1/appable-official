/**
 * OpenRouter — premium escalation (Claude / GPT / Gemini).
 * Used only for complex tasks when OPENROUTER_API_KEY is set.
 */
import { openrouterConfig } from "@/lib/config";
import { trackLlmCost } from "@/lib/aiBillingContext";

export type OpenRouterChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | OpenRouterContentPart[];
};

export type OpenRouterContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export async function openRouterChatComplete(
  messages: OpenRouterChatMessage[],
  opts: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
    json?: boolean;
  } = {}
): Promise<{ text: string; costUsd: number }> {
  const key = openrouterConfig.key;
  const base = openrouterConfig.baseUrl;
  if (!key || !base) return { text: "", costUsd: 0 };

  const model = opts.model ?? openrouterConfig.models.text;
  const url = `${base.replace(/\/$/, "")}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://appable.app",
        "X-Title": "Appable",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1024,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[openRouterChatComplete]", res.status, errBody.slice(0, 300));
      return { text: "", costUsd: 0 };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { total_cost?: number; cost?: number };
    };

    const text = (data.choices?.[0]?.message?.content ?? "").trim();
    const costUsd =
      typeof data.usage?.total_cost === "number"
        ? data.usage.total_cost
        : typeof data.usage?.cost === "number"
          ? data.usage.cost
          : 0;
    if (costUsd > 0) trackLlmCost(costUsd);

    return { text, costUsd };
  } catch (err) {
    console.error("[openRouterChatComplete] failed:", err);
    return { text: "", costUsd: 0 };
  } finally {
    clearTimeout(timer);
  }
}
