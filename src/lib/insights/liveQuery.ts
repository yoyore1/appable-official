import type { Project } from "@/lib/types";
import { flashChatComplete } from "@/lib/flashChat";
import { founderVoiceBlock } from "@/lib/expoApp/founderVoice";
import { resolveReportsPhase, reportsPhaseMessage } from "./reportsLifecycle";
import { pullAllInsights } from "./providers";
import { resolveInsightsDataStage } from "./modes";
import { stagingFilterHint } from "./staging";

export async function answerInsightsQuestion(
  project: Project,
  question: string
): Promise<{ answer: string; snapshots: import("./types").IntegrationInsightSnapshot[] }> {
  const reportsPhase = resolveReportsPhase(project);

  if (reportsPhase === "pre_launch") {
    return {
      answer:
        reportsPhaseMessage(project) +
        " Ask in Brainstorm what to connect before launch.",
      snapshots: [],
    };
  }

  if (reportsPhase === "warming_up") {
    return {
      answer: reportsPhaseMessage(project),
      snapshots: [],
    };
  }

  const snapshots = await pullAllInsights(project);
  const stage = resolveInsightsDataStage(project, snapshots);
  const env = project.insightsState?.analyticsEnvironment ?? "production";

  if (stage === "waiting" || stage === "explore") {
    return {
      answer:
        "No live user data yet — connect integrations, wire events in Build, and ship. " +
        stagingFilterHint(env),
      snapshots,
    };
  }

  const context = snapshots
    .map(
      (s) =>
        `${s.connectorId}: ${s.headline} (${s.health}) metrics=${JSON.stringify(s.metrics)} summary=${s.summary}`
    )
    .join("\n");

  const { text } = await flashChatComplete(
    [
      {
        role: "system",
        content:
          `Live insights assistant for ${project.masterPrompt?.appName ?? "app"}. ` +
          `${founderVoiceBlock(project.masterPrompt?.appName)} ` +
          "Answer using ONLY the metrics below. Short, direct.",
      },
      {
        role: "user",
        content: `Data (${stage}):\n${context}\n\nQuestion: ${question}`,
      },
    ],
    { temperature: 0.45, maxTokens: 350, timeoutMs: 25_000 }
  );

  return { answer: text.trim() || "Could not parse live data — try again.", snapshots };
}
