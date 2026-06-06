/**
 * Model clients. Each function calls a real OpenAI-compatible endpoint when the
 * relevant env vars are set, and otherwise returns a believable MOCK result so
 * the product is fully clickable with no API keys.
 *
 * - chat model (Step 3.5) → interview acks, ASO copy
 * - plan model (Kimi K2.6) → master-prompt synthesis after interview
 * - image model           → launch-pack screenshots + icon
 * - video model           → launch-pack video ad specs (stub)
 */
import { chatModel, imageModel, integrations, planModel } from "@/lib/config";
import {
  answerFor,
  inferVibe,
  resolveAppName,
  resolveColors,
} from "@/lib/interviewHelpers";

type ModelEndpoint = { baseUrl?: string; key?: string; name?: string };
import type {
  InterviewTurn,
  LaunchAssets,
  MasterBuildPrompt,
  Vibe,
} from "@/lib/types";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** Step-3.5-Flash on DeepInfra rejects `response_format: json_object` (HTTP 405). */
function modelSupportsJsonMode(modelName?: string): boolean {
  const name = (modelName ?? "").toLowerCase();
  return !name.includes("step-3.5") && !name.includes("step3.5");
}

async function chatComplete(
  messages: ChatMessage[],
  opts: {
    json?: boolean;
    temperature?: number;
    maxTokens?: number;
    timeoutMs?: number;
  } = {},
  endpoint: ModelEndpoint = chatModel
): Promise<string> {
  if (!endpoint.baseUrl || !endpoint.key) return "";
  const url = `${endpoint.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${endpoint.key}`,
      },
      body: JSON.stringify({
        model: endpoint.name,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 512,
        // Step-3.5-Flash rejects json_object (HTTP 405) — Kimi can use it.
        ...(opts.json && modelSupportsJsonMode(endpoint.name)
          ? { response_format: { type: "json_object" } }
          : {}),
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(
        `[chatComplete] ${res.status}`,
        errBody.slice(0, 300)
      );
      return "";
    }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    const text = (msg?.content ?? "").trim();
    // Step-3.5 sometimes leaves content empty; never surface raw reasoning to users.
    return text;
  } catch (err) {
    console.error("[chatComplete] failed:", err);
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/** Pull JSON object from a model reply (handles markdown fences). */
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
        /* fall through */
      }
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
  }
  return null;
}

/** Second bubble after every answer — short hype, always the same beat. */
const HYPE_LINE: Record<string, string> = {
  idea: "Love it.",
  audience: "Perfect.",
  features: "Love those.",
  name: "Love it.",
  colors: "Gorgeous.",
};

const ACK_CONTEXT: Record<string, string> = {
  idea: "They shared their app idea.",
  audience: "They said who the app is for.",
  features: "They listed the main things the app does.",
  name: "They picked or asked for an app name.",
  colors: "They picked color preferences.",
};

const GENERIC_HYPE_ONLY =
  /^(that'?s fire|love it|ooh yes|so good|nice!?|perfect|okay yes|yes|fire|yup|makes sense|got it|love that)\.?!?$/i;

const ANALYSIS_RE =
  /user wants|let me break|first,|next,|they mentioned|the app needs|functionality|scenario|so the app|i need to|break down/i;

/** True if the reply nods to something the user actually said. */
function referencesAnswer(line: string, answer: string): boolean {
  const tokens = answer.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const lower = line.toLowerCase();
  return tokens.some((t) => lower.includes(t));
}

function answerSnippet(answer: string, max = 34): string {
  return (
    answer
      .trim()
      .split(/[.!?\n]/)[0]
      ?.slice(0, max)
      .trim()
      .toLowerCase() ?? ""
  );
}

/** Personal warm texting line built from what they actually typed. */
function warmFromAnswer(questionId: string, answer: string): string {
  const a = answer.toLowerCase();
  const bit = answerSnippet(answer);

  if (questionId === "idea") {
    if (
      (/recipe|dish|food|meal|cook|ingredient/.test(a)) &&
      (/photo|pic|camera|picture|snap|roll|gallery/.test(a))
    ) {
      return "Wait snap a dish and get the recipe?? That's so useful.";
    }
    if (bit.length > 8) return `Okay ${bit} — I kind of love that.`;
    return "Wait that's actually such a good idea.";
  }

  if (questionId === "audience") {
    if (/mom|mother|parent/.test(a) && /young|adult|teen|cook|learn/.test(a)) {
      return "Okay moms + people learning to cook — that's such a real niche.";
    }
    if (/young|teen|student|adult|beginner|busy/.test(a) && bit.length > 6) {
      return `Yeah ${bit} — totally get who you mean.`;
    }
    if (bit.length > 6) return `Okay ${bit} — makes total sense who this is for.`;
    return "Yeah I can totally picture who'd use this.";
  }

  if (questionId === "features") {
    const first = answer.split(/[,;]|\band\b/i)[0]?.trim().toLowerCase();
    if (first && first.length > 4) {
      return `Okay ${first} — that's a solid core feature.`;
    }
    if (bit.length > 6) return `Love that it does ${bit}.`;
    return "Yeah those are exactly the right things.";
  }

  if (questionId === "name") {
    if (/suggest|you pick|name it|surprise/i.test(a)) {
      return "Okay I'll cook up the perfect name for this.";
    }
    const n = answer.trim();
    if (n.length > 1) return `${n} — that's a great name.`;
    return "Okay yeah we'll find the perfect name.";
  }

  if (questionId === "colors") {
    if (/surprise|you pick|idk|don't know|anything/.test(a)) {
      return "Okay I'll make it look incredible — trust me.";
    }
    if (bit.length > 3) return `Ooh ${bit} — that's going to be beautiful.`;
    return "Okay those colors are going to eat.";
  }

  return bit.length > 6 ? `Okay ${bit} — love that.` : "Okay yeah I'm into this.";
}

/** Reject interview-speak and empty hype — first bubble must feel personal. */
function sanitizeWarmLine(
  raw: string,
  questionId: string,
  answer: string
): string {
  const t = raw.trim().replace(/^["']|["']$/g, "");
  const tooLong = t.length > 88;
  const soundsLikeAnalysis = ANALYSIS_RE.test(t);
  const tooManySentences = (t.match(/[.!?]/g)?.length ?? 0) > 1;
  const tooGeneric =
    GENERIC_HYPE_ONLY.test(t) ||
    (!referencesAnswer(t, answer) && t.split(/\s+/).length < 8);

  if (!t || tooLong || soundsLikeAnalysis || tooManySentences || tooGeneric) {
    return warmFromAnswer(questionId, answer);
  }
  return t;
}

/**
 * After every answer: personal warm text → short hype → next question.
 * e.g. idea → "Wait snap a dish…" → "Love it." → "Who's it for?"
 */
export async function interviewAck(
  prevAnswer: string,
  questionId: string
): Promise<string[]> {
  const hype = HYPE_LINE[questionId] ?? "Love it.";
  const ctx = ACK_CONTEXT[questionId] ?? "They replied to your question.";

  // Fast path: template already nods to their words — skip the API round-trip.
  const templated = warmFromAnswer(questionId, prevAnswer);
  if (referencesAnswer(templated, prevAnswer)) {
    return [templated, hype];
  }

  if (integrations.chatModel) {
    const warm = await chatComplete(
      [
        {
          role: "system",
          content:
            `${ctx} Reply with ONE casual texting message (max 14 words). ` +
            "MUST nod to something specific they said — use their words. Warm, hyped, iMessage.\n\n" +
            "GOOD: \"Okay moms + people learning to cook — so real.\", \"Wait snap-a-dish → recipe?? genius.\"\n" +
            "BAD: Generic only (\"Makes sense.\", \"Perfect.\", \"That's fire.\"), summaries, analysis, questions.",
        },
        { role: "user", content: prevAnswer },
      ],
      { temperature: 0.85, maxTokens: 36, timeoutMs: 12_000 }
    );
    const warmLine = warm
      ? sanitizeWarmLine(warm, questionId, prevAnswer)
      : warmFromAnswer(questionId, prevAnswer);
    return [warmLine, hype];
  }

  return [warmFromAnswer(questionId, prevAnswer), hype];
}

/**
 * Synthesize the structured master build prompt the build engine consumes.
 * Uses the chat model when configured; otherwise a deterministic local builder.
 */
export async function generateMasterPrompt(
  interview: InterviewTurn[]
): Promise<MasterBuildPrompt> {
  const idea = answerFor(interview, "idea");
  const audience = answerFor(interview, "audience");
  const featuresRaw = answerFor(interview, "features");
  const appName = resolveAppName(interview);
  const vibe = inferVibe(interview);
  const colors = resolveColors(answerFor(interview, "colors"), interview);

  if (integrations.planModel) {
    const content = await chatComplete(
      [
        {
          role: "system",
          content:
            "Turn this app interview into a master build prompt as STRICT JSON " +
            "with keys: appName, description, audience, features (array of 3 " +
            "short strings), vibe (one of Cinematic, Minimal, Bold, Soft, Luxury), " +
            "colors, screens (array of 4-6 screen names). " +
            "Use the provided appName exactly. Infer vibe from the app type. No prose, JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({ idea, audience, featuresRaw, appName, vibe, colors }),
        },
      ],
      // Kimi puts output in reasoning when json_object is on — prompt-only JSON instead.
      { json: false, temperature: 0.3, maxTokens: 1500, timeoutMs: 45_000 },
      planModel
    );
    const parsed = parseJsonFromText<MasterBuildPrompt>(content);
    if (parsed?.appName) return parsed;
  }

  const features = featuresRaw
    .split(/[,\n;]| and /i)
    .map((f) => f.trim())
    .filter(Boolean)
    .slice(0, 3);
  while (features.length < 3) features.push(["Onboarding", "Home feed", "Profile"][features.length]);

  const screens = ["Onboarding", "Home", ...features.map((f) => `${f} screen`), "Profile"].slice(0, 6);

  return {
    appName,
    description: idea || "A delightful native iOS app.",
    audience: audience || "Everyday people who want something simple and beautiful.",
    features,
    vibe,
    colors,
    screens,
  };
}

/** ASO copy for the launch pack. */
export async function generateAso(
  prompt: MasterBuildPrompt
): Promise<NonNullable<LaunchAssets["aso"]>> {
  if (integrations.chatModel) {
    const content = await chatComplete(
      [
        {
          role: "system",
          content:
            "Write App Store optimization copy as STRICT JSON: title (<=30 " +
            "chars), subtitle (<=30 chars), keywords (array of 8), description " +
            "(2 short paragraphs). JSON only.",
        },
        { role: "user", content: JSON.stringify(prompt) },
      ],
      { json: true, temperature: 0.6 }
    );
    const parsed = parseJsonFromText<NonNullable<LaunchAssets["aso"]>>(content);
    if (parsed?.title) return parsed;
  }
  return {
    title: prompt.appName.slice(0, 30),
    subtitle: `${prompt.vibe} & simple`.slice(0, 30),
    keywords: [
      prompt.appName.toLowerCase(),
      prompt.vibe.toLowerCase(),
      ...prompt.features.map((f) => f.toLowerCase().split(" ")[0]),
      "app",
      "ios",
      "simple",
    ].slice(0, 8),
    description:
      `${prompt.description}\n\n` +
      `Made for ${prompt.audience}. ${prompt.features.join(", ")} — all in one ` +
      `beautifully ${prompt.vibe.toLowerCase()} app.`,
  };
}

/** Soft gradient SVG placeholders so screenshots/icon render without an image API. */
function gradientDataUri(hue: number, label: string, w = 320, h = 640): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='hsl(${hue},85%,72%)'/>
      <stop offset='100%' stop-color='hsl(${hue + 24},80%,88%)'/>
    </linearGradient></defs>
    <rect width='100%' height='100%' rx='28' fill='url(#g)'/>
    <text x='50%' y='50%' font-family='sans-serif' font-size='20' fill='white'
      text-anchor='middle' opacity='0.9'>${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function generateScreenshots(
  prompt: MasterBuildPrompt
): Promise<{ screenshots: NonNullable<LaunchAssets["screenshots"]>; icon: NonNullable<LaunchAssets["icon"]> }> {
  // Real image model wiring (GPT Image 2) goes here when imageModel is configured.
  void integrations.imageModel;
  void imageModel;
  const hue = 8;
  const screenshots = prompt.screens.slice(0, 4).map((s, i) => ({
    url: gradientDataUri(hue + i * 6, s),
    caption: s,
  }));
  return {
    screenshots,
    icon: { url: gradientDataUri(hue, prompt.appName.slice(0, 2).toUpperCase(), 256, 256) },
  };
}

export async function generateVideoAds(
  prompt: MasterBuildPrompt
): Promise<NonNullable<LaunchAssets["videoAds"]>> {
  // Seedance wiring goes here later. Stub returns 3 scripts/specs.
  const hooks = [
    "POV: you just built your own app",
    `The ${prompt.vibe.toLowerCase()} app everyone's asking about`,
    "I made this in one afternoon (no code)",
  ];
  return hooks.map((hook, i) => ({
    title: `Ad ${i + 1}: ${hook}`,
    script:
      `0-2s: ${hook}.\n` +
      `2-6s: Show ${prompt.features[i % prompt.features.length]} in action.\n` +
      `6-9s: "${prompt.appName} — ${prompt.description.slice(0, 40)}".\n` +
      `9-12s: CTA "Get it on the App Store".`,
    spec: "9:16, 12s, captions on, trending audio, soft coral grade.",
  }));
}
