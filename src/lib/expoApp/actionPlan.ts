import { integrations, planModel } from "@/lib/config";
import { trackLlmCost } from "@/lib/aiBillingContext";
import { parseDeepInfraCost } from "@/lib/deepinfraCost";
import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import {
  collectPrimaryActionLabels,
  seedActionPlan,
} from "./actionPlanSeed";
import type { ExpoAppModelInput, PreviewActionPlan } from "./types";

function mergePlans(base: PreviewActionPlan, next?: PreviewActionPlan | null): PreviewActionPlan {
  if (!next?.rules?.length) return base;
  const byMatch = new Map(base.rules.map((r) => [r.match.toLowerCase(), r]));
  for (const rule of next.rules) {
    byMatch.set(rule.match.toLowerCase(), { ...byMatch.get(rule.match.toLowerCase()), ...rule });
  }
  return {
    messagingTabId: next.messagingTabId ?? base.messagingTabId,
    feedTabId: next.feedTabId ?? base.feedTabId,
    rules: [...byMatch.values()],
  };
}

async function callPlanModel(system: string, user: string): Promise<string> {
  if (!integrations.planModel || !planModel.baseUrl || !planModel.key) return "";
  const url = `${planModel.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${planModel.key}`,
    },
    body: JSON.stringify({
      model: planModel.name,
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) return "";
  const data = await res.json();
  trackLlmCost(parseDeepInfraCost(data));
  return (data?.choices?.[0]?.message?.content ?? "").trim();
}

/** Kimi reviews seed rules — domain-specific toasts, tabs, and next steps. */
export async function reviewActionPlanWithKimi(
  input: ExpoAppModelInput,
  mp: MasterBuildPrompt,
  interview: InterviewTurn[]
): Promise<PreviewActionPlan> {
  const seed = input.previewActions ?? seedActionPlan(input);
  if (!integrations.planModel) return seed;

  const system = `You review mobile app button logic for a web preview. Output STRICT JSON: { "previewActions": PreviewActionPlan }.

PreviewActionPlan schema:
{
  "messagingTabId": "existing tab id for chat/compose outcomes or omit",
  "feedTabId": "existing tab id for browse/list outcomes or omit",
  "rules": [{
    "match": "exact primaryAction label from the app",
    "kind": "open_detail"|"compose_message"|"update_status"|"navigate_tab"|"save",
    "toast": "short user-facing confirmation for THIS app",
    "navigateTabId": "only if kind is navigate_tab — must exist in tabs",
    "statusBadge": "for update_status",
    "statusMeta": "for update_status",
    "nextPrimaryAction": "optional follow-up button label",
    "detailAppend": "optional sentence appended to detail body",
    "composeTitle": "for compose_message",
    "openDetailAfter": true|false
  }]
}

Rules:
- Use ONLY tab ids from the provided tabs array.
- Every primaryAction label in the app must have exactly one matching rule (match field).
- Outcomes must make sense for "${mp.appName}" and what the user described — not generic dog-walking unless that IS the app.
- compose_message for Reply/Message/Chat buttons.
- update_status when the button changes state (Apply, Accept, Book, Start, Complete, Post…).
- save only for Save/Favorite.
- Do NOT invent fake list items or hardcoded names — only describe state changes and navigation.`;

  const user = JSON.stringify({
    appName: mp.appName,
    description: mp.description,
    audience: mp.audience,
    features: mp.features,
    tabs: input.tabs,
    primaryActions: collectPrimaryActionLabels(input),
    seedPlan: seed,
    interviewSnippets: interview.map((t) => t.answer).filter(Boolean).slice(0, 8),
  });

  try {
    const text = await callPlanModel(system, user);
    if (!text) return seed;
    const parsed = JSON.parse(text) as { previewActions?: PreviewActionPlan };
    return mergePlans(seed, parsed.previewActions);
  } catch {
    return seed;
  }
}

export async function ensureActionPlan(
  input: ExpoAppModelInput,
  mp: MasterBuildPrompt,
  interview: InterviewTurn[]
): Promise<ExpoAppModelInput> {
  const seeded = { ...input, previewActions: seedActionPlan(input) };
  const reviewed = await reviewActionPlanWithKimi(seeded, mp, interview);
  return { ...input, previewActions: reviewed };
}
