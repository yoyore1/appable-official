/**
 * Parse actual USD cost from DeepInfra API responses.
 * Chat: usage.estimated_cost · Inference: inference_status.cost
 */
export type AiChatResult = {
  text: string;
  costUsd: number;
};

export function parseDeepInfraCost(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  const d = data as Record<string, unknown>;

  const usage = d.usage;
  if (usage && typeof usage === "object") {
    const estimated = (usage as Record<string, unknown>).estimated_cost;
    if (typeof estimated === "number" && estimated >= 0) {
      return estimated;
    }
  }

  const inference = d.inference_status;
  if (inference && typeof inference === "object") {
    const cost = (inference as Record<string, unknown>).cost;
    if (typeof cost === "number" && cost >= 0) {
      return cost;
    }
  }

  return 0;
}
