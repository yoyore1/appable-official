import {
  suggestAppIdeasBatch,
  suggestSimilarIdea,
  playbookSlotFromIdea,
  type SuggestMode,
  type SuggestedAppIdea,
} from "@/lib/suggestAppIdeas";
import type { PlaybookSlot } from "@/lib/archetypes";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(req: Request) {
  let topic = "";
  let variant = 0;
  let mode: SuggestMode = "topic";
  let slotIndex = 0;
  let slot: PlaybookSlot | null = null;

  try {
    const body = (await req.json()) as {
      topic?: string;
      variant?: number;
      mode?: string;
      slotIndex?: number;
      idea?: SuggestedAppIdea;
    };
    topic = String(body.topic ?? "").trim();
    variant = Math.max(0, Math.min(9, Math.floor(Number(body.variant) || 0)));
    mode =
      body.mode === "discover" || body.mode === "similar" ? body.mode : "topic";
    slotIndex = Math.max(0, Math.min(2, Math.floor(Number(body.slotIndex) || 0)));

    if (body.idea?.archetype && body.idea.nicheTopic) {
      slot = playbookSlotFromIdea(body.idea, slotIndex);
    }
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  if (mode === "similar") {
    if (!slot) {
      return Response.json({ error: "idea required for similar mode" }, { status: 400 });
    }
    const idea = await suggestSimilarIdea(slot, variant);
    return Response.json({ idea });
  }

  if (mode === "topic") {
    if (!topic || topic.length > 200) {
      return Response.json({ error: "Topic required (max 200 chars)" }, { status: 400 });
    }
  }

  const { ideas, discover } = await suggestAppIdeasBatch(mode, topic, variant);
  return Response.json({ ideas, discover });
}
