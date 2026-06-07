/**
 * Interview acks + suggestions — Qwen 3.6 (default) or Kimi via INTERVIEW_MODEL.
 * No category templates; idea-tailored fallback if LLM fails.
 */
import { answerFor } from "@/lib/interviewHelpers";
import { flashChatComplete } from "@/lib/flashChat";
import { interviewLlmProvider } from "@/lib/config";
import type { AiChatResult } from "@/lib/deepinfraCost";
import { planChatComplete, type PlanChatMessage } from "@/lib/planChat";
import type { InterviewTurn } from "@/lib/types";
import {
  APPABLE_PICK,
  fallbackSuggestionsForStep,
} from "@/lib/interviewSuggestions";
import type { InterviewStepId } from "@/lib/interviewFlow";
import {
  assessPoolGaps,
  isPoolStepId,
  POOL_QUESTION_IDS,
  selectPoolQuestionsSync,
  type PoolQuestionId,
} from "@/lib/interviewQuestionPool";
import {
  clarifyPromptForAnchor,
  ideaTailoredSuggestions,
  type ClarifyAnchor,
} from "@/lib/interviewUnderstanding";

async function interviewChatComplete(
  messages: PlanChatMessage[],
  opts: {
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  } = {}
): Promise<AiChatResult> {
  if (interviewLlmProvider === "kimi") {
    return planChatComplete(messages, opts);
  }
  return flashChatComplete(messages, opts);
}

function parseJsonFromText<T>(text: string): T | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim()) as T;
      } catch {
        /* */
      }
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T;
      } catch {
        /* */
      }
    }
  }
  return null;
}

const META_SUGGEST_RE =
  /^(first|second|third)\s+pill|pill\s*[:\d]|the user is|so i need to|i need to produce|checked all|word count|return json|output exactly|one pill per|three pills|tap-to-send|use everyday terms|reflect the real|real-world relationship|seeking the service|are the ones/i;

function cleanPillLine(line: string): string {
  return line
    .replace(/^[\s\-*•]+/, "")
    .replace(/^\d+[\.\)]\s*/, "")
    .replace(/^(first|second|third)\s+pill\s*[:\-–—]?\s*/i, "")
    .replace(/^pill\s*\d+\s*[:\-–—]?\s*/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function wordCount(line: string): number {
  return line.trim().split(/\s+/).filter(Boolean).length;
}

function isMetaSuggestionLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (META_SUGGEST_RE.test(lower)) return true;
  if (line.length > 70 && /\?/.test(line)) return true;
  if (/^(okay|sure|alright|got it),/i.test(line) && line.length > 50) return true;
  if (/^(okay|sure|yes|got it)\.?$/i.test(line.trim())) return true;
  if (wordCount(line) > 12) return true;
  if (wordCount(line) <= 1) return true;
  return false;
}

function parseSuggestionLines(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const candidates: string[] = [];

  for (const line of trimmed.split(/\n+/)) {
    const clean = cleanPillLine(line);
    if (
      clean.length > 2 &&
      clean.length < 120 &&
      !isMetaSuggestionLine(clean)
    ) {
      candidates.push(clean);
    }
  }

  if (candidates.length < 2 && /[,;]/.test(trimmed)) {
    for (const part of trimmed.split(/[,;]+/)) {
      const clean = cleanPillLine(part);
      if (
        clean.length > 2 &&
        clean.length < 120 &&
        !isMetaSuggestionLine(clean)
      ) {
        candidates.push(clean);
      }
    }
  }

  const unique: string[] = [];
  for (const line of candidates) {
    const lower = line.toLowerCase();
    if (!unique.some((u) => u.toLowerCase() === lower)) unique.push(line);
    if (unique.length >= 3) break;
  }
  return unique;
}

function transcript(interview: InterviewTurn[]): string {
  return interview
    .map((t) => `[${t.questionId}] Q: ${t.question}\nA: ${t.answer}`)
    .join("\n\n");
}

const GENERIC_ACK_RE =
  /connecting people|i can totally picture the app|that's actually such a good idea|tell me more/i;

const GENERIC_PILL_RE =
  /people who need help nearby|freelancers offering local|customers?\s*&\s*providers?|both sides\s*[—–-]\s*customers|early adopters willing|people who run into this problem/i;

const ACK_SYSTEM = `You text like a sharp friend helping someone design an app.
Reply with ONE short message only (8–22 words). React to what they JUST said.
You MUST name something specific from their answer — roles, actions, or nouns (babysitters, parents, alarm, photo, dog walkers, etc.).
BANNED: "connecting people", "I can totally picture the app", generic hype with zero specifics.
Never ask the next question. No analysis.`;

const SUGGEST_SYSTEM =
  'Return JSON only: { "suggestions": ["...", "...", "..."] }. ' +
  "Each string is what the USER taps to answer the interview question — a direct answer in their voice, not advice or design notes. " +
  "Reuse their exact roles and nouns from the app idea (alarm, photo, sun, snooze, walker, recipe, etc.). " +
  "Never output generic marketplace or 'busy everyday users' unless the idea is actually a marketplace. " +
  "Max 12 words each. No meta text, labels, or reasoning.";

function keyTerms(text: string): string[] {
  const stop = new Set([
    "app",
    "that",
    "with",
    "who",
    "need",
    "them",
    "their",
    "this",
    "what",
    "when",
    "where",
    "have",
    "from",
    "your",
    "they",
    "would",
    "could",
    "about",
    "matches",
    "match",
    "matching",
  ]);
  const words =
    text.toLowerCase().match(/[a-z]{4,}/g)?.filter((w) => !stop.has(w)) ?? [];
  const unique: string[] = [];
  for (const w of words) {
    if (!unique.includes(w)) unique.push(w);
    if (unique.length >= 3) break;
  }
  return unique;
}

export function minimalAckFromAnswer(answer: string): string {
  const terms = keyTerms(answer);
  if (terms.length >= 2) {
    return `Okay ${terms[0]} + ${terms[1]} — I get the shape of this.`;
  }
  if (terms.length === 1) {
    return `Yeah a ${terms[0]} angle — makes sense.`;
  }
  return "Yeah that's specific enough to build from.";
}

export function isGenericInterviewAck(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 8) return true;
  if (GENERIC_ACK_RE.test(t)) return true;
  if (/wait\s*—\s*\w+\s+and\s+\w+\?\s*that'?s a really clear app/i.test(t)) {
    return true;
  }
  return false;
}

function stepGuidance(stepId: string, stepPrompt: string, idea: string): string {
  const header = `QUESTION TO ANSWER: "${stepPrompt}"\nApp idea: "${idea}"`;

  if (stepId === "audience") {
    return (
      `${header}\n` +
      "Three direct answers naming WHO uses this app — real people/roles from their idea. " +
      'Dog walkers: "Busy dog owners nearby", "Teen walkers earning side cash". ' +
      'Photo-alarm apps: "Heavy snoozers", "Shift workers with early alarms", "Students who oversleep".'
    );
  }
  if (stepId === "features") {
    return (
      `${header}\n` +
      "Three direct answers listing what the app DOES — concrete features using their nouns."
    );
  }
  if (stepId === "name") {
    return `${header}\nThree short app name ideas that fit this app.`;
  }
  if (stepId === "idea") {
    return "Three distinct, specific app ideas — different domains.";
  }
  if (stepId === "followup_idea") {
    return (
      `${header}\n` +
      "Three direct answers: what someone does on first open through to the payoff — use their nouns."
    );
  }
  if (stepId === "followup_features") {
    return (
      `${header}\n` +
      "Three step-by-step flow answers (open → tap → … → done) using their app's roles and actions."
    );
  }
  if (stepId === "followup_recipe_depth") {
    return (
      `${header}\n` +
      "Three direct answers about required fields, detail level, or special rules for THEIR app — not design advice."
    );
  }
  if (stepId.startsWith("followup_clarify_")) {
    return `${header}\nThree short direct answers the user would send. Use their nouns.`;
  }
  if (isPoolStepId(stepId)) {
    if (stepId === "pool_core_loop") {
      return `${header}\nThree direct feature answers using their nouns — what the app DOES.`;
    }
    if (stepId === "pool_who") {
      return `${header}\nThree direct answers naming WHO uses this — from their idea.`;
    }
    if (stepId === "pool_rules" || stepId === "pool_proof") {
      return `${header}\nThree direct answers about rules, requirements, or verification.`;
    }
    return `${header}\nThree direct answers about first use — use their nouns.`;
  }
  return `${header}\nThree direct answers the user would send.`;
}

function normalizePills(items: string[]): string[] {
  return items
    .map((s) => cleanPillLine(s))
    .filter(
      (s) =>
        s.length > 2 &&
        s.length < 120 &&
        !GENERIC_PILL_RE.test(s) &&
        !isMetaSuggestionLine(s)
    );
}

function suggestionsValidForStep(
  items: string[],
  stepId: string,
  idea: string
): boolean {
  if (items.length < 2 || !suggestionsOnTopic(items, idea)) return false;

  const blob = items.join(" ").toLowerCase();

  if (stepId === "audience") {
    const namesWho =
      /owner|walker|parent|user|people|busy|local|neighbor|gig|student|professional|both|side|teen|adult|snooz|sleeper|morning|alarm|wake|shift|worker|heavy|early|oversleep|riser/i.test(
        blob
      );
    const soundsLikeNotes =
      /use everyday|reflect the|relationship|seeking the service|design|instruction/i.test(
        blob
      );
    return namesWho && !soundsLikeNotes;
  }

  if (stepId === "features") {
    return !/anything we should lock in|how detailed it gets|what info users must enter/i.test(
      blob
    );
  }

  if (stepId === "followup_recipe_depth") {
    return /require|must|rule|field|detail|verify|optional|minimum|keep|form|proof/i.test(
      blob
    );
  }

  if (stepId === "followup_features" || stepId === "followup_idea") {
    return /open|tap|→|->|then|first|next|apply|match|post|browse|done/i.test(
      blob
    );
  }

  return true;
}

function wordInText(word: string, text: string): boolean {
  const w = word.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(w)) return true;
  if (w.endsWith("s") && t.includes(w.slice(0, -1))) return true;
  if (!w.endsWith("s") && t.includes(`${w}s`)) return true;
  return false;
}

function suggestionsOnTopic(items: string[], idea: string): boolean {
  if (items.length < 2 || !idea.trim()) return items.length >= 2;
  const blob = items.join(" ");
  const ideaWords = idea
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
  return ideaWords.some((w) => wordInText(w, blob));
}

export async function interviewAiAck(
  prevAnswer: string,
  questionId: string,
  priorInterview: InterviewTurn[],
  strict = false
): Promise<string> {
  const prior = transcript(
    priorInterview.filter((t) => t.questionId !== questionId)
  );
  const terms = keyTerms(prevAnswer);

  const { text } = await interviewChatComplete(
    [
      { role: "system", content: ACK_SYSTEM },
      {
        role: "user",
        content: [
          prior ? `Interview so far:\n${prior}\n` : "",
          `They just answered (${questionId}): ${prevAnswer}`,
          terms.length ? `Include at least one of: ${terms.join(", ")}` : "",
          strict ? "Last reply was too generic — use their exact roles." : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    {
      temperature: strict ? 0.65 : 0.8,
      maxTokens: interviewLlmProvider === "kimi" ? 256 : 256,
      timeoutMs: interviewLlmProvider === "kimi" ? 60_000 : 45_000,
    }
  );

  return text.replace(/^["']|["']$/g, "").trim();
}

async function suggestOnce(
  stepId: string,
  stepPrompt: string,
  interview: InterviewTurn[],
  strict: boolean
): Promise<string[]> {
  const prior = transcript(interview);
  const idea = answerFor(interview, "idea");

  const { text: raw } = await interviewChatComplete(
    [
      { role: "system", content: SUGGEST_SYSTEM },
      {
        role: "user",
        content: [
          prior ? `Interview so far:\n${prior}` : "Interview so far: (just starting)",
          stepGuidance(stepId, stepPrompt, idea),
          strict ? "Too generic before — use their exact words from the idea." : "",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    {
      temperature: strict ? 0.35 : 0.45,
      maxTokens: interviewLlmProvider === "kimi" ? 512 : 512,
      timeoutMs: interviewLlmProvider === "kimi" ? 60_000 : 45_000,
    }
  );

  const parsed = parseJsonFromText<{ suggestions?: string[] }>(raw);
  const fromJson = normalizePills(parsed?.suggestions ?? []);
  if (fromJson.length >= 2) return fromJson;

  return normalizePills(parseSuggestionLines(raw));
}

export async function interviewAiSuggestions(
  stepId: string,
  stepPrompt: string,
  interview: InterviewTurn[]
): Promise<string[]> {
  const idea = answerFor(interview, "idea");

  let items = await suggestOnce(stepId, stepPrompt, interview, false);

  if (items.length < 2 || !suggestionsValidForStep(items, stepId, idea)) {
    items = await suggestOnce(stepId, stepPrompt, interview, true);
  }

  if (items.length < 2 || !suggestionsValidForStep(items, stepId, idea)) {
    const { text: raw } = await interviewChatComplete(
      [
        {
          role: "system",
          content:
            'Return JSON only: { "suggestions": ["...", "...", "..."] }. ' +
            "Each answer must match their specific app idea. Max 12 words each.",
        },
        {
          role: "user",
          content: JSON.stringify({
            stepId,
            question: stepPrompt,
            appIdea: idea,
            interview: transcript(interview),
          }),
        },
      ],
      { temperature: 0.35, maxTokens: 320, timeoutMs: 20_000 }
    );
    const parsed = parseJsonFromText<{ suggestions?: string[] }>(raw);
    items = normalizePills(parsed?.suggestions ?? []);
  }

  const tailored = ideaTailoredSuggestions(stepId as InterviewStepId, interview);
  if (tailored?.length) {
    const pills = tailored.filter((s) => s !== APPABLE_PICK).slice(0, 3);
    if (pills.length >= 2) {
      return [...pills, APPABLE_PICK];
    }
  }

  if (!suggestionsValidForStep(items, stepId, idea)) {
    const fallback = fallbackSuggestionsForStep(stepId as InterviewStepId, interview);
    const nonPick = fallback.filter((s) => s !== APPABLE_PICK);
    if (nonPick.length >= 2) return fallback;
    return [APPABLE_PICK];
  }

  if (items.length === 0) return tailored?.length ? [...tailored.filter((s) => s !== APPABLE_PICK).slice(0, 3), APPABLE_PICK] : [APPABLE_PICK];
  if (items.length === 1) return [items[0], APPABLE_PICK];
  return [...items.slice(0, 3), APPABLE_PICK];
}

/** Kimi picks 0–2 questions from the curated pool (no monetization). */
export async function interviewAiPickPoolPlan(
  interview: InterviewTurn[]
): Promise<PoolQuestionId[]> {
  const sync = selectPoolQuestionsSync(interview);
  if (sync.length === 0) return [];

  const gaps = assessPoolGaps(interview);
  const eligible = POOL_QUESTION_IDS.filter((id) => gaps[id]);
  if (eligible.length === 0) return [];

  const idea = answerFor(interview, "idea");

  let text = "";
  try {
    const res = await interviewChatComplete(
      [
        {
          role: "system",
          content:
            'Return JSON only: { "pick": ["pool_who"|"pool_core_loop"|"pool_rules"|"pool_proof"|"pool_first_use"] }. ' +
            "Pick 0–2 ids from eligible ONLY. Skip what the idea already answers. Never monetization. " +
            "pool_first_use if vague. pool_who if audience unclear. pool_core_loop if flow unclear. " +
            "pool_rules/pool_proof for photo-alarm-verify apps missing constraints.",
        },
        {
          role: "user",
          content: JSON.stringify({
            appIdea: idea,
            eligible,
            ruleBasedPick: sync,
          }),
        },
      ],
      { temperature: 0.25, maxTokens: 220, timeoutMs: 30_000 }
    );
    text = res.text;
  } catch {
    return sync;
  }
  if (!text.trim()) return sync;

  const parsed = parseJsonFromText<{ pick?: string[] }>(text);
  const pick = (parsed?.pick ?? [])
    .filter((id): id is PoolQuestionId => isPoolStepId(id) && gaps[id])
    .slice(0, 2);
  return pick.length > 0 ? pick : sync;
}

/** One targeted clarify question when we are not confident — uses Kimi when available. */
export async function interviewAiClarifyPrompt(
  anchor: ClarifyAnchor,
  interview: InterviewTurn[]
): Promise<string> {
  const ruleBased = clarifyPromptForAnchor(anchor, interview);
  const idea = answerFor(interview, "idea");

  const { text } = await interviewChatComplete(
    [
      {
        role: "system",
        content:
          "You help design an app. Return JSON only: { \"question\": \"...\" }. " +
          "ONE short clarifying question (max 22 words) in plain friend-texting tone. " +
          "Reference their specific nouns (alarm, photo, sun, dog, etc.). " +
          "Do NOT ask a generic 'who is it for' unless anchor is audience. " +
          "Do NOT suggest features they already stated.",
      },
      {
        role: "user",
        content: JSON.stringify({
          anchor,
          appIdea: idea,
          interview: transcript(interview),
          fallbackQuestion: ruleBased,
        }),
      },
    ],
    {
      temperature: 0.4,
      maxTokens: 180,
      timeoutMs: interviewLlmProvider === "kimi" ? 45_000 : 25_000,
    }
  );

  const parsed = parseJsonFromText<{ question?: string }>(text);
  const q = parsed?.question?.trim();
  if (q && q.length >= 12 && q.length < 160) return q;
  return ruleBased;
}

export async function interviewAiRecommend(
  stepId: string,
  stepPrompt: string,
  interview: InterviewTurn[]
): Promise<string> {
  const { text: raw } = await interviewChatComplete(
    [
      {
        role: "system",
        content:
          "Pick the best interview answer from everything they said. " +
          'Features: 2–3 comma-separated. Return JSON only: { "answer": "..." }',
      },
      {
        role: "user",
        content: JSON.stringify({
          questionId: stepId,
          question: stepPrompt,
          interviewSoFar: transcript(interview),
        }),
      },
    ],
    { temperature: 0.35, maxTokens: 320, timeoutMs: 20_000 }
  );
  const parsed = parseJsonFromText<{ answer?: string }>(raw);
  return parsed?.answer?.trim() ?? "";
}

/** @deprecated alias */
export const kimiInterviewAck = interviewAiAck;
/** @deprecated alias */
export const kimiInterviewSuggestions = interviewAiSuggestions;
/** @deprecated alias */
export const kimiRecommendAnswer = interviewAiRecommend;
