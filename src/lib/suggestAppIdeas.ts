import "server-only";
import {
  pickDiscoverSlots,
  pickPlaybookSlotsForTopic,
  type LayoutArchetype,
  type PlaybookSlot,
} from "@/lib/archetypes";
import { integrations, suggestIdeasModel } from "@/lib/config";
import { parseDeepInfraCost } from "@/lib/deepinfraCost";

export type SuggestedAppIdea = {
  name: string;
  description: string;
  explanation: string;
  archetype: LayoutArchetype;
  nicheTopic: string;
};

export type SuggestMode = "topic" | "discover" | "similar";

const SUGGEST_TIMEOUT_MS = 9_000;
const DEEP_TIMEOUT_MS = 7_000;
const BATCH_MAX_TOKENS = 520;
const SIMILAR_MAX_TOKENS = 200;
const DEEP_MAX_TOKENS = 220;

const FALLBACK_NAMES: Record<string, string[]> = {
  "tracker-dashboard": ["Progress Log", "Daily Metrics", "Track Board"],
  "habit-streak": ["Streak Keeper", "Daily Check-in", "Routine Ring"],
  "content-library": ["Learn Hub", "Browse & Go", "Pick & Play"],
  "booking-scheduling": ["Book Easy", "Slot Finder", "Reserve Now"],
  "marketplace-shop": ["Mini Shop", "Browse & Buy", "Local Market"],
  "social-feed": ["Your Feed", "Share Circle", "Community Board"],
  "chat-messaging": ["Quick Chat", "Message Hub", "Group Line"],
  "swipe-cards": ["Swipe & Find", "Card Stack", "Discover Deck"],
  "journal-notes": ["Quick Notes", "Thought Log", "Daily Journal"],
  "onboarding-heavy-utility": ["Setup Guide", "Tool Kit", "Step One"],
};

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

function extractText(data: unknown): string {
  const choice = (
    data as { choices?: Array<{ message?: { content?: unknown } }> }
  )?.choices?.[0];
  const raw = choice?.message?.content ?? "";
  if (typeof raw === "string") return stripReasoning(raw);
  if (Array.isArray(raw)) {
    return stripReasoning(
      raw
        .map((part) =>
          typeof part === "string"
            ? part
            : part && typeof part === "object" && "text" in part
              ? String((part as { text?: string }).text ?? "")
              : ""
        )
        .join("")
    );
  }
  return "";
}

function slotTopic(slot: PlaybookSlot, fallback: string): string {
  return slot.nicheTopic?.trim() || fallback;
}

function ideaFromSlot(
  slot: PlaybookSlot,
  index: number,
  topic: string,
  partial?: Partial<SuggestedAppIdea>
): SuggestedAppIdea {
  const t = slotTopic(slot, topic);
  const name = partial?.name ?? fallbackName(slot, index);
  const description =
    partial?.description ??
    (slot.useLikeComparison
      ? `Like ${slot.referenceApp} for ${t}.`
      : `A simple ${slot.label.toLowerCase()} focused on ${t}.`);
  const explanation = partial?.explanation ?? fallbackExplanation(slot, t);
  return {
    name,
    description,
    explanation,
    archetype: slot.archetype,
    nicheTopic: t,
  };
}

function normalizeIdeas(raw: unknown[], slots: PlaybookSlot[], topic: string): SuggestedAppIdea[] | null {
  const ideas: SuggestedAppIdea[] = [];
  for (let i = 0; i < raw.length && i < slots.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = String(o.name ?? o.title ?? o.appName ?? "").trim();
    const description = String(o.description ?? o.tagline ?? o.hook ?? "").trim();
    const explanation = String(o.explanation ?? o.detail ?? "").trim();
    if (!name || !description || !explanation) continue;
    ideas.push(ideaFromSlot(slots[i]!, i, topic, { name, description, explanation }));
  }
  return ideas.length > 0 ? ideas : null;
}

function parseIdeasJson(
  text: string,
  slots: PlaybookSlot[],
  topic: string
): SuggestedAppIdea[] | null {
  const trimmed = stripReasoning(text.trim());
  const tryParse = (raw: string): SuggestedAppIdea[] | null => {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return normalizeIdeas(parsed, slots, topic);
      if (parsed && typeof parsed === "object") {
        const o = parsed as Record<string, unknown>;
        if (Array.isArray(o.ideas)) return normalizeIdeas(o.ideas, slots, topic);
        if (o.idea && typeof o.idea === "object") {
          const one = normalizeIdeas([o.idea], slots.slice(0, 1), topic);
          return one;
        }
      }
    } catch {
      /* */
    }
    return null;
  };

  const direct = tryParse(trimmed);
  if (direct) return direct;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return tryParse(fenced[1].trim());
  return null;
}

function playbookBlock(slots: PlaybookSlot[], topic: string, discover: boolean): string {
  return slots
    .map((slot, i) => {
      const angle = slotTopic(slot, topic);
      const niche = slot.nicheLabel ? `Niche: ${slot.nicheLabel}. ` : "";
      const refs = slot.useLikeComparison
        ? `Reference app: ${slot.referenceApp} (comparison only — never in the name field).`
        : "No trademark or “like X” in the description — original pitch only.";
      return (
        `Idea ${i + 1} — ${niche}${slot.label}: ${slot.patternHint}. ` +
        `Angle: "${angle}". Core features: ${slot.features.join("; ")}. ${refs}`
      );
    })
    .join("\n")
    .concat(
      discover
        ? "\nUser did not enter a topic — each idea MUST be a different niche."
        : `\nUser topic: "${topic}".`
    );
}

function buildBatchPrompt(
  slots: PlaybookSlot[],
  topic: string,
  discover: boolean,
  isQwen: boolean
): string {
  const prefix = isQwen ? "/no_think " : "";
  return (
    prefix +
    'Reply with ONLY JSON: { "ideas": [ { "name": "...", "description": "...", "explanation": "..." } ] } — exactly 3 ideas.\n' +
    "RULES:\n" +
    "- Ideas 1 & 2: description MUST be one short line starting with “Like [App] for [specific audience or twist]”. Use the reference app for that slot. Never put brand names in name.\n" +
    "- Idea 3: description is a punchy original pitch with NO trademark and NO “like” comparison.\n" +
    "- explanation: exactly 2 short sentences (about 20–35 words). Plain English. What they open the app and do — start with verbs. No jargon.\n" +
    "- name: original, brandable, 2–4 words. Never a trademark.\n" +
    "- Do not imply endorsement or affiliation with any named app.\n" +
    (discover
      ? "- CRITICAL: All 3 ideas must be in DIFFERENT niches — do not repeat the same audience or category.\n"
      : "- All 3 ideas should fit the user topic but use different app shapes.\n") +
    "\nPLAYBOOK:\n" +
    playbookBlock(slots, topic, discover)
  );
}

function buildSimilarPrompt(slot: PlaybookSlot, topic: string, isQwen: boolean): string {
  const prefix = isQwen ? "/no_think " : "";
  const angle = slotTopic(slot, topic);
  const likeRule = slot.useLikeComparison
    ? `description MUST start with “Like ${slot.referenceApp} for …” (fresh angle on "${angle}").`
    : "description is an original pitch with NO trademark and NO “like” comparison.";
  return (
    prefix +
    'Reply with ONLY JSON: { "idea": { "name": "...", "description": "...", "explanation": "..." } }.\n' +
    `One beginner-friendly mobile app. Pattern: ${slot.label}. ${likeRule}\n` +
    "explanation: 2 short sentences, plain English. name: original, 2–4 words, no trademark.\n" +
    `Angle: "${angle}". Features: ${slot.features.join("; ")}.`
  );
}

function fallbackName(slot: PlaybookSlot, index: number): string {
  const pool = FALLBACK_NAMES[slot.archetype] ?? ["App Idea"];
  return pool[index % pool.length]!;
}

function fallbackExplanation(slot: PlaybookSlot, topic: string): string {
  const t = topic.trim() || "your interest";
  const [a, b, c] = slot.features;
  return (
    `${a} for ${t} in a few taps. ` +
    `${b}, and ${c.charAt(0).toLowerCase()}${c.slice(1)} — all in one simple app.`
  );
}

function playbookFallback(topic: string, slots: PlaybookSlot[]): SuggestedAppIdea[] {
  const t = topic.trim() || "your interest";
  return slots.map((slot, i) => ideaFromSlot(slot, i, t));
}

async function chatCompletion(
  system: string,
  user: string,
  maxTokens: number,
  timeoutMs: number
): Promise<string | null> {
  if (!integrations.chatModel || !suggestIdeasModel.baseUrl || !suggestIdeasModel.key) {
    return null;
  }

  const isQwen = (suggestIdeasModel.name ?? "").toLowerCase().includes("qwen");
  const url = `${suggestIdeasModel.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const body: Record<string, unknown> = {
    model: suggestIdeasModel.name,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.68,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  };

  if (isQwen) {
    body.chat_template_kwargs = { enable_thinking: false };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${suggestIdeasModel.key}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(
        `[suggestIdeas] ${res.status} model=${suggestIdeasModel.name}`,
        (await res.text().catch(() => "")).slice(0, 200)
      );
      return null;
    }

    const data = await res.json();
    parseDeepInfraCost(data);
    return extractText(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/abort/i.test(msg)) console.error("[suggestIdeas] failed:", msg);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function resolveSlots(mode: SuggestMode, topic: string, variant: number): PlaybookSlot[] {
  if (mode === "discover") return pickDiscoverSlots(variant);
  return pickPlaybookSlotsForTopic(topic, variant);
}

/** Batch of 3 ideas — topic focus or lost-user discover. */
export async function suggestAppIdeasBatch(
  mode: SuggestMode,
  topic: string,
  variant = 0
): Promise<{ ideas: SuggestedAppIdea[]; discover: boolean }> {
  const discover = mode === "discover";
  const t = topic.trim();
  const slots = resolveSlots(discover ? "discover" : "topic", t, variant);
  const topicLabel = discover ? "exploring app ideas" : t;
  const fallback = playbookFallback(topicLabel, slots);

  const isQwen = (suggestIdeasModel.name ?? "").toLowerCase().includes("qwen");
  const system = buildBatchPrompt(slots, topicLabel, discover, isQwen);
  const user =
    variant > 0
      ? `Generate 3 fresh beginner-friendly mobile app ideas. Variation ${variant + 1} — new names and angles.`
      : "Generate 3 beginner-friendly mobile app ideas.";

  const text = await chatCompletion(system, user, BATCH_MAX_TOKENS, SUGGEST_TIMEOUT_MS);
  const parsed = text ? parseIdeasJson(text, slots, topicLabel) : null;

  if (parsed && parsed.length >= 3) return { ideas: parsed.slice(0, 3), discover };
  if (parsed && parsed.length > 0) {
    return { ideas: [...parsed, ...fallback].slice(0, 3), discover };
  }
  return { ideas: fallback, discover };
}

/** @deprecated — use suggestAppIdeasBatch */
export async function suggestAppIdeasForTopic(
  topic: string,
  variant = 0
): Promise<SuggestedAppIdea[]> {
  const { ideas } = await suggestAppIdeasBatch("topic", topic, variant);
  return ideas;
}

/** Replace one card with a similar idea (same niche / archetype). */
export async function suggestSimilarIdea(
  slot: PlaybookSlot,
  variant = 0
): Promise<SuggestedAppIdea | null> {
  const topic = slotTopic(slot, "your interest");
  const isQwen = (suggestIdeasModel.name ?? "").toLowerCase().includes("qwen");
  const system = buildSimilarPrompt(slot, topic, isQwen);
  const user = `Fresh similar idea. Variation ${variant + 1}. Different name and hook than before.`;

  const text = await chatCompletion(system, user, SIMILAR_MAX_TOKENS, SUGGEST_TIMEOUT_MS);
  const parsed = text ? parseIdeasJson(text, [slot], topic) : null;
  if (parsed?.[0]) return parsed[0];

  return ideaFromSlot(slot, variant + 1, topic);
}

function fallbackDeepExplanation(idea: SuggestedAppIdea): string {
  return (
    `${idea.name} is for people drawn to ${idea.nicheTopic} who want something simple on their phone — no spreadsheets, no complicated setup. ` +
    `You'd open it for a quick session, follow the flow in the short description above, and come back when it matters. ` +
    `It's built to feel familiar from apps you already know, but focused on your niche so it doesn't feel generic.`
  );
}

/** Deeper “tell me more” copy for one idea — does not count toward the 4-use cap. */
export async function suggestDeepExplanation(idea: SuggestedAppIdea): Promise<string> {
  const isQwen = (suggestIdeasModel.name ?? "").toLowerCase().includes("qwen");
  const prefix = isQwen ? "/no_think " : "";
  const system =
    prefix +
    'Reply with ONLY JSON: { "deepExplanation": "..." }.\n' +
    "Write 3–4 sentences (about 45–70 words). Plain English for a non-technical person.\n" +
    "Cover: who this is for, what a typical day/session looks like, and why it could earn or save them time/money.\n" +
    "No jargon. Do not repeat the hook verbatim. Do not claim endorsement from any named app.";

  const user = `App: ${idea.name}\nHook: ${idea.description}\nShort: ${idea.explanation}\nNiche: ${idea.nicheTopic}`;

  const text = await chatCompletion(system, user, DEEP_MAX_TOKENS, DEEP_TIMEOUT_MS);
  if (text) {
    try {
      const parsed = JSON.parse(stripReasoning(text.trim())) as { deepExplanation?: string };
      const deep = String(parsed.deepExplanation ?? "").trim();
      if (deep) return deep;
    } catch {
      /* */
    }
  }
  return fallbackDeepExplanation(idea);
}

export function playbookSlotFromIdea(idea: SuggestedAppIdea, index: number): PlaybookSlot {
  const slots = pickPlaybookSlotsForTopic(idea.nicheTopic, 0);
  const base = slots.find((s) => s.archetype === idea.archetype) ?? slots[0]!;
  return {
    ...base,
    nicheTopic: idea.nicheTopic,
    useLikeComparison: index < 2 ? base.useLikeComparison : idea.description.toLowerCase().includes("like "),
  };
}
