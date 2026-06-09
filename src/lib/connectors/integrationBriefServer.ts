/** Server-only integration deep-dive research — do not import from client components. */

import type { ConnectorId } from "./catalog";
import {
  formatIntegrationPlaybooks,
  integrationAccountSetupHint,
  integrationPlaybook,
} from "./integrationPrompts";
import { getConnectorDefinition } from "./registry";
import type { BrainstormTurn, InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import { flashChatComplete } from "@/lib/flashChat";
import {
  retrieveBrainstormContext,
  formatRetrievedContextForPrompt,
} from "@/lib/expoApp/brainstormRetrieve";
import type { AppReadinessAudit, ReadinessItem } from "@/lib/expoApp/readinessAudit";
import type { ExpoAppModel } from "@/lib/expoApp/types";
import {
  founderIntegrationBriefOutline,
  founderVoiceBlock,
} from "@/lib/expoApp/founderVoice";

function buildDeepDiveSystem(
  mp: MasterBuildPrompt,
  integrationId: ConnectorId,
  contextBlock: string
): string {
  const def = getConnectorDefinition(integrationId);
  const account = integrationAccountSetupHint(integrationId);
  const playbook = integrationPlaybook(integrationId, mp.appName);

  return (
    "You are an integration research analyst for mobile founders. They requested a FULL INTEGRATION BRIEF — be thorough, specific, and actionable. " +
    "No filler openers. Never paste API keys. Use **bold** section headers.\n\n" +
    `${founderVoiceBlock(mp.appName)}\n\n` +
    `Integration: **${def.displayName}** — ${def.role}\n` +
    `App: **${mp.appName}**\n\n` +
    `${founderIntegrationBriefOutline(mp.appName)}\n` +
    `\nAccount & keys detail: ${account ?? "create account or log in, where to copy keys, paste in Integrations"}\n\n` +
    `Implementation playbook: ${playbook}\n\n` +
    contextBlock
  );
}

function threadSnippet(history: BrainstormTurn[], max = 8): string {
  return history
    .slice(-max)
    .map((t) => `${t.role === "user" ? "Founder" : "Coach"}: ${t.content}`)
    .join("\n\n");
}

export async function runIntegrationDeepDive(
  mp: MasterBuildPrompt,
  history: BrainstormTurn[],
  integrationId: ConnectorId,
  userMessage: string,
  options?: {
    model?: ExpoAppModel | null;
    interview?: InterviewTurn[];
    audit?: AppReadinessAudit | null;
    pinnedItem?: ReadinessItem | null;
    existingSummary?: string;
    connectorNote?: string;
  }
): Promise<{ reply: string; summary: string }> {
  const previewModel = options?.model ?? null;
  const interview = options?.interview ?? [];
  const audit = options?.audit ?? null;
  const summary = options?.existingSummary ?? "";

  const retrieved = retrieveBrainstormContext(
    userMessage,
    history,
    mp,
    previewModel,
    audit,
    interview,
    options?.pinnedItem ?? null,
    summary
  );

  const playbooks = formatIntegrationPlaybooks(
    [integrationId, ...retrieved.integrationIds],
    mp.appName
  );

  const contextBlock = formatRetrievedContextForPrompt(
    { ...retrieved, integrationIds: [integrationId, ...retrieved.integrationIds] },
    summary,
    [options?.connectorNote, playbooks].filter(Boolean).join("\n\n") || null
  );

  const system = buildDeepDiveSystem(mp, integrationId, contextBlock);
  const def = getConnectorDefinition(integrationId);

  const messages = [
    { role: "system" as const, content: system },
    ...history.slice(-8).map((t) => ({
      role: t.role as "user" | "assistant",
      content: t.content,
    })),
    {
      role: "user" as const,
      content:
        `${userMessage}\n\n` +
        `Go deep on **${def.displayName}** for **${mp.appName}**. ` +
        `Maximize practical value: ROI, concrete in-app examples, and setup order. ` +
        `Recent chat context:\n${threadSnippet(history)}`,
    },
  ];

  const { text } = await flashChatComplete(messages, {
    temperature: 0.62,
    maxTokens: 1400,
    timeoutMs: 55_000,
  });

  const reply = text.trim().slice(0, 2800);

  const { text: summaryText } = await flashChatComplete(
    [
      {
        role: "system",
        content:
          `Update brainstorm notes for ${mp.appName}. Max 4 bullets. ` +
          `Include integration brief takeaway. Plain text only.`,
      },
      {
        role: "user",
        content:
          `Previous:\n${summary || "(empty)"}\n\n` +
          `Brief topic: ${def.displayName}\n` +
          `Research:\n${reply.slice(0, 1200)}\n\nUpdated notes:`,
      },
    ],
    { temperature: 0.3, maxTokens: 220, timeoutMs: 18_000 }
  );

  return {
    reply: reply || `Couldn't load the full ${def.displayName} brief — try again.`,
    summary: summaryText.trim().slice(0, 500) || summary,
  };
}
