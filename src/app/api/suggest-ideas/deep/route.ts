import { suggestDeepExplanation, type SuggestedAppIdea } from "@/lib/suggestAppIdeas";

export const runtime = "nodejs";
export const maxDuration = 12;

export async function POST(req: Request) {
  let idea: SuggestedAppIdea | null = null;
  try {
    const body = (await req.json()) as { idea?: SuggestedAppIdea };
    if (
      body.idea?.name &&
      body.idea.description &&
      body.idea.explanation &&
      body.idea.archetype &&
      body.idea.nicheTopic
    ) {
      idea = body.idea;
    }
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!idea) {
    return Response.json({ error: "idea required" }, { status: 400 });
  }

  const deepExplanation = await suggestDeepExplanation(idea);
  return Response.json({ deepExplanation });
}
