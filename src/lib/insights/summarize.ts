import { flashChatComplete } from "@/lib/flashChat";
import { founderVoiceBlock } from "@/lib/expoApp/founderVoice";
import type { Project } from "@/lib/types";
import type { IntegrationInsightSnapshot } from "./types";

export async function summarizeSnapshot(
  project: Project,
  snapshot: IntegrationInsightSnapshot
): Promise<IntegrationInsightSnapshot> {
  if (snapshot.health === "not_configured" || snapshot.health === "no_data") {
    return snapshot;
  }
  if (!project.masterPrompt) return snapshot;

  try {
    const { text } = await flashChatComplete(
      [
        {
          role: "system",
          content:
            `Write 2 sentences max for a founder dashboard. ${founderVoiceBlock(project.masterPrompt.appName)} ` +
            "No filler. Focus product levers, not user business advice.",
        },
        {
          role: "user",
          content: `Integration: ${snapshot.connectorId}\nHeadline: ${snapshot.headline}\nMetrics: ${JSON.stringify(snapshot.metrics)}`,
        },
      ],
      { temperature: 0.4, maxTokens: 120, timeoutMs: 15_000 }
    );
    if (text.trim()) return { ...snapshot, summary: text.trim() };
  } catch {
    /* keep deterministic summary */
  }
  return snapshot;
}

export async function overallWeeklyHeadline(
  project: Project,
  snapshots: IntegrationInsightSnapshot[]
): Promise<string> {
  const hits = snapshots.filter((s) => s.health === "ok");
  if (!hits.length) return "Waiting for your first user data";
  if (hits.length === 1) return hits[0]!.headline;
  return `${hits.length} integrations reported this week`;
}
