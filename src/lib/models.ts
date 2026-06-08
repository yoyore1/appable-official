/**
 * Model clients. Each function calls a real OpenAI-compatible endpoint when the
 * relevant env vars are set, and otherwise returns a believable MOCK result so
 * the product is fully clickable with no API keys.
 *
 * - chat model (Step 3.5) → ASO copy, tweak chat
 * - plan model (Kimi K2.6) → interview acks, suggestions, master-prompt synthesis
 * - image model           → launch-pack screenshots + icon
 * - video model           → launch-pack video ad specs (stub)
 */
import { chatModel, integrations, planModel } from "@/lib/config";
import { APPABLE_PICK } from "@/lib/interviewSuggestions";
import {
  interviewAiAck,
  interviewAiRecommend,
  interviewAiSuggestions,
  isGenericInterviewAck,
} from "@/lib/interviewAi";
import {
  inferArchetypeFromInterview,
  inferFromReference,
  normalizeMasterPrompt,
} from "@/lib/archetypes";
import { dynamicInterviewContext, hasDetailedFlow } from "@/lib/dynamicInterview";
import { mergeFeatureList, parseUserFeatures } from "@/lib/expoApp/featurePlan";
import { isReferencePath } from "@/lib/interviewFlow";
import {
  answerFor,
  resolveAppName,
  resolveColors,
  resolveVibe,
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
): Promise<{ text: string; costUsd: number }> {
  if (!endpoint.baseUrl || !endpoint.key) return { text: "", costUsd: 0 };
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
      return { text: "", costUsd: 0 };
    }
    const data = await res.json();
    const { parseDeepInfraCost } = await import("@/lib/deepinfraCost");
    const { trackLlmCost } = await import("@/lib/aiBillingContext");
    const costUsd = parseDeepInfraCost(data);
    trackLlmCost(costUsd);
    const msg = data?.choices?.[0]?.message;
    const text = (msg?.content ?? "").trim();
    return { text, costUsd };
  } catch (err) {
    console.error("[chatComplete] failed:", err);
    return { text: "", costUsd: 0 };
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

const ACK_CONTEXT: Record<string, string> = {
  reference_branch: "They said whether they have a similar app in mind.",
  reference_name: "They named an app that's similar in type (not a copy target).",
  idea: "They shared their app idea.",
  audience: "They said who the app is for.",
  features: "They listed the main things the app does.",
  twist: "They described who's it's for and their unique twist.",
  name: "They picked or asked for an app name.",
  colors: "They picked color preferences.",
  followup_idea: "They gave a concrete first-use example.",
  followup_features: "They described the step-by-step core flow.",
  followup_recipe_depth: "They said how detailed recipes should be.",
  followup_clarify_idea: "They clarified how the app should work.",
  followup_clarify_audience: "They clarified who the app is for.",
  followup_clarify_features: "They clarified the core flow.",
  pool_who: "They said who the app is for.",
  pool_core_loop: "They listed what the app does.",
  pool_rules: "They set hard rules for the app.",
  pool_proof: "They explained how verification works.",
  pool_first_use: "They described the first-use experience.",
  followup_twist: "They named their key differentiator.",
};

const GENERIC_HYPE_ONLY =
  /^(that'?s fire|love it|ooh yes|so good|nice!?|perfect|okay yes|yes|fire|yup|makes sense|got it|love that)\.?!?$/i;

const TEMPLATE_ACK_RE =
  /i kind of love that|solid core feature|heart of the|that's the heart|makes total sense who|totally get who you mean|those are exactly the right things|that's a great name|i'm into this|perfect —|that helps a lot/i;

const ANALYSIS_RE =
  /user wants|let me break|first,|next,|they mentioned|the app needs|functionality|scenario|so the app|i need to|break down/i;

function hashPick(seed: string, options: string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return options[Math.abs(h) % options.length];
}

/** True if the reply nods to something the user actually said. */
function referencesAnswer(line: string, answer: string): boolean {
  const tokens = answer.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const lower = line.toLowerCase();
  return tokens.some((t) => lower.includes(t));
}

function firstFeature(answer: string): string {
  return answer.split(/[,;]|\band\b/i)[0]?.trim() ?? "";
}

function featureListItems(answer: string): string[] {
  if (isFlowDescription(answer)) return [];
  return answer
    .split(/[,;]|\band\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && s.split(/\s+/).length <= 10);
}

/** Long walkthrough of what happens — not a bullet list of features. */
function isFlowDescription(answer: string): boolean {
  const a = answer.toLowerCase();
  const words = a.split(/\s+/).filter(Boolean).length;
  if (words < 10) return false;
  return (
    /apply|match|vice versa|then|first|next|→|->|people that|people who|or you can/.test(
      a
    ) ||
    ((a.match(/,/g)?.length ?? 0) >= 2 &&
      /put|enter|post|set|choose|pick|type|add/.test(a))
  );
}

function shortFeatureLabel(item: string, maxWords = 5): string {
  return item
    .trim()
    .split(/\s+/)
    .slice(0, maxWords)
    .join(" ")
    .toLowerCase();
}

/** Ack for a step-by-step user journey — not the first comma clause. */
function flowAck(seed: string, answer: string): string {
  const a = answer.toLowerCase();
  if (
    /breed|dog/.test(a) &&
    /area|location|neighborhood|zip/.test(a) &&
    /pay|price|budget|\$|much/.test(a) &&
    /apply|match/.test(a)
  ) {
    return hashPick(seed, [
      "Wait owners post breed + area + pay and walkers apply? That's the whole loop.",
      "Okay and it works both ways — owners or walkers can match. Smart.",
      "Yeah post details, walkers apply, match — I can totally picture that.",
    ]);
  }
  if (/apply/.test(a) && /match/.test(a)) {
    return hashPick(seed, [
      "Okay apply + match both ways — that's what makes it a real marketplace.",
      "Wait either side can make the first move? Yeah that works.",
      "Yeah the two-sided matching piece is the whole point.",
    ]);
  }
  if (isFlowDescription(answer)) {
    return hashPick(seed, [
      "Okay yeah I can follow that whole flow — super clear.",
      "Wait that's literally the journey from open to done. Love it.",
      "Yeah that sequence makes sense — I know what to build.",
    ]);
  }
  return hashPick(seed, [
    "Okay that flow clicks — I know what screens we need.",
    "Yeah walking through it like that helps a ton.",
  ]);
}

function interviewContextLines(interview: InterviewTurn[]): string {
  return interview
    .map((t) => `${t.questionId}: ${t.answer}`)
    .join("\n");
}

/** Short nod to what they typed — never chop mid-word. */
function answerSnippet(answer: string, max = 56): string {
  const first =
    answer
      .trim()
      .split(/[.!?\n]/)[0]
      ?.trim() ?? "";
  if (!first) return "";
  if (first.length <= max) return first;

  const cut = first.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const safe = (lastSpace > 14 ? cut.slice(0, lastSpace) : cut).trim();
  return safe;
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Short semantic label for acks — never a chopped copy of their sentence. */
function semanticHook(answer: string): string {
  const a = answer.toLowerCase();
  const pairs: [RegExp, string][] = [
    [/dog\s*walk|walker|pet\s*sit|dog\s*sit/, "dog walkers"],
    [/connect|match|link/, "connecting people"],
    [/area|location|nearby|local|neighborhood|zip/, "by area"],
    [/flight|travel|trip/, "finding flights"],
    [/recipe|dish|meal|cook|food/, "recipes"],
    [/\bpic\b|\bphoto\b|camera|snap|picture|upload.*image/, "photo-first"],
    [/book|appointment|schedule/, "booking"],
    [/streak|habit|daily/, "daily habits"],
    [/chat|message|dm/, "messaging"],
    [/track|progress|chart/, "tracking progress"],
  ];
  for (const [re, phrase] of pairs) {
    if (re.test(a)) return phrase;
  }
  return "";
}

/** @deprecated Use semanticHook — never echo truncated user text in acks. */
function hookPhrase(answer: string): string {
  return semanticHook(answer);
}

/** Personal warm texting line — varied, tied to what they actually said. */
function warmFromAnswer(
  questionId: string,
  answer: string,
  priorInterview: InterviewTurn[] = []
): string {
  const a = answer.toLowerCase();
  const hook = hookPhrase(answer);
  const idea = answerFor(priorInterview, "idea").toLowerCase();
  const seed = `${questionId}:${answer}`;

  if (questionId === "idea") {
    if (/dog|pet|puppy/.test(a) && /walk|walker|sitter|sit/.test(a)) {
      return hashPick(seed, [
        "Wait a dog walker app that matches by neighborhood?? People would actually use that.",
        "Okay connecting dog walkers to owners nearby — that's such a real problem.",
        "Dog walkers + people in their area on one app — yeah that's needed.",
      ]);
    }
    if (/connect|match|marketplace|link/.test(a) && /area|location|nearby|local|neighborhood/.test(a)) {
      return hashPick(seed, [
        "Oh matching people by area — that's what makes this actually work.",
        "Yeah the local piece is everything for something like this.",
        "Connecting nearby instead of random — smart angle.",
      ]);
    }
    if (
      /recipe|dish|food|meal|cook|ingredient/.test(a) &&
      /\bpic\b|\bphoto\b|camera|snap|picture/.test(a)
    ) {
      return hashPick(seed, [
        "Wait snap a dish and get the recipe?? That's so useful.",
        "Photo → recipe is one of those ideas that just clicks.",
        "Okay yeah I'd use that every time I'm at a restaurant.",
      ]);
    }
    if (/\bpic\b|\bphoto\b|camera|snap|picture|upload.*(pic|photo|image)/.test(a)) {
      return hashPick(seed, [
        "Okay so the camera is the core move — that's a really clear hook.",
        "Wait photo-first apps hit different when the flow is obvious — I'm into it.",
        "Yeah take a pic and the app does the rest — I can picture that.",
      ]);
    }
    if (/flight|travel|trip|hotel/.test(a)) {
      return hashPick(seed, [
        "A travel app that actually finds good flights — yes please.",
        "Okay yeah travel + flights is always a pain to get right.",
        "Wait you're tackling flights? That's a crowded space but people always want a better one.",
      ]);
    }
    if (/fitness|workout|gym|run/.test(a)) {
      return hashPick(seed, [
        "Another fitness app but yours actually sounds focused — I'm into it.",
        "Okay workout tracking that people would stick with — that's the hard part.",
        "Yeah the fitness space is huge but the right angle still wins.",
      ]);
    }
    if (/book|appointment|schedule|calendar/.test(a)) {
      return hashPick(seed, [
        "Booking stuff on your phone without the headache — that's the dream.",
        "Okay appointments without ten back-and-forths — I'd download that.",
        "Yeah scheduling apps only work when they're dead simple.",
      ]);
    }
    if (hook) {
      return hashPick(seed, [
        `Wait — ${hook} is actually a really clear angle.`,
        `Okay yeah ${hook} — I can totally picture the app.`,
        `${capitalizeFirst(hook)} — that could be really good.`,
      ]);
    }
    return hashPick(seed, [
      "Wait that's actually such a good idea.",
      "Okay yeah tell me more — I'm already picturing it.",
      "Hmm yeah I could see people using that.",
    ]);
  }

  if (questionId === "audience") {
    const ideaBit = idea ? answerSnippet(idea, 28) : "";
    if (/dog|pet|owner/.test(a) && /dog|pet|walk/.test(idea)) {
      return hashPick(seed, [
        "Yeah busy dog owners who don't have time to walk — that's the person.",
        "Okay pet parents in your area — makes total sense for this.",
        "Dog owners who need help nearby — yep that's your crowd.",
      ]);
    }
    if (/mom|mother|parent/.test(a) && /young|adult|teen|cook|learn/.test(a)) {
      return "Okay moms + people learning to cook — that's such a real niche.";
    }
    if (ideaBit && /owner|walker|provider|freelance/.test(a)) {
      return hashPick(seed, [
        `So both sides — ${answerSnippet(answer, 36)} for your ${ideaBit} thing. Smart.`,
        `Yeah ${answerSnippet(answer, 32)} is exactly who needs this.`,
        `Okay ${answerSnippet(answer, 36)} — I get the split now.`,
      ]);
    }
    if (answerSnippet(answer, 36).length > 8) {
      return hashPick(seed, [
        `Yeah ${answerSnippet(answer, 36)} — I can picture them opening this.`,
        `${capitalizeFirst(answerSnippet(answer, 36))} — that's a clear who.`,
        `Okay so ${answerSnippet(answer, 32)} — makes sense for what you described.`,
      ]);
    }
    return hashPick(seed, [
      "Yeah I can totally picture who'd use this.",
      "Okay that helps — I know who we're building for now.",
      "Got it — that's a real audience, not vague 'everyone'.",
    ]);
  }

  if (questionId === "features") {
    if (isFlowDescription(answer)) {
      return flowAck(seed, answer);
    }
    const items = featureListItems(answer);
    if (items.length >= 2) {
      const a0 = shortFeatureLabel(items[0]);
      const a1 = shortFeatureLabel(items[1]);
      return hashPick(seed, [
        `Okay ${a0}, ${a1} — solid combo.`,
        `Yeah ${a0} plus ${a1} — covers the main use cases.`,
        items.length >= 3
          ? `Three clear pieces — ${a0}, ${a1}, and the rest. Good.`
          : `Two strong features — ${a0} and ${a1}.`,
      ]);
    }
    const first = firstFeature(answer);
    if (first.length > 4 && first.split(/\s+/).length <= 8) {
      return hashPick(seed, [
        `Okay ${shortFeatureLabel(first)} — that's a strong anchor.`,
        `Yeah ${shortFeatureLabel(first)} — I get what the app does.`,
      ]);
    }
    return hashPick(seed, [
      "Yeah those features together actually tell a story.",
      "Okay that combo makes sense for what you're building.",
      "Love it — those aren't random features, they fit.",
    ]);
  }

  if (questionId === "followup_features") {
    return flowAck(seed, answer);
  }

  if (questionId === "followup_idea") {
    if (/open|first|tap|snap|upload|search|book/.test(a)) {
      return hashPick(seed, [
        "Okay yeah that's a clear first session — I can picture it.",
        "Wait that's exactly what someone would do on day one. Good.",
        "Yeah that first-use moment is super clear now.",
      ]);
    }
    return hashPick(seed, [
      "Okay that helps — I know what happens when they open it.",
      "Yeah picturing that first use — makes sense.",
    ]);
  }

  if (questionId === "name") {
    if (/suggest|you pick|name it|surprise/i.test(a)) {
      return hashPick(seed, [
        "Okay I'll cook up something that fits the vibe.",
        "On it — I'll find a name that actually sounds like your app.",
        "Yeah let me think of something catchy for this.",
      ]);
    }
    const n = answer.trim();
    if (n.length > 1) {
      return hashPick(seed, [
        `${n} — yeah that lands.`,
        `Wait ${n} is actually really good.`,
        `${n} — I can see that on the home screen.`,
      ]);
    }
    return "Okay yeah we'll find the perfect name.";
  }

  if (questionId === "reference_branch") {
    if (/yes/i.test(a)) return "Nice — that'll help us nail the structure.";
    return "Love it — something fully yours.";
  }

  if (questionId === "reference_name") {
    const bit = answerSnippet(answer);
    if (bit.length > 2) return `Got it — like ${bit}, but built your way.`;
    return "That helps — we'll use it for structure, not a copy.";
  }

  if (questionId.startsWith("followup_")) {
    const bit = answerSnippet(answer, 52);
    if (bit.length > 10) {
      return hashPick(seed, [
        `Okay — ${bit}. That'll shape the build.`,
        `Got it — locking in ${bit}.`,
        `Yeah ${bit} — noted for the build.`,
      ]);
    }
    return "Yeah that detail will shape the build.";
  }

  if (questionId === "twist") {
    const bit = answerSnippet(answer);
    if (bit.length > 8) return `Okay ${bit} — that's a real twist.`;
    return "Yeah that's how you make it yours, not a clone.";
  }

  if (questionId === "colors") {
    if (/no preference|skip|none/i.test(a)) return "We'll use a clean default palette.";
    if (/recommend|you think|u think|think is best|pick for me|your call|surprise/i.test(a)) {
      return "On it — I'll pick colors that fit your app and audience.";
    }
    const bit = answerSnippet(answer);
    if (bit.length > 3) return hashPick(seed, [`${bit} — yeah that fits.`, `Ooh ${bit} — nice pick.`]);
    return "Those colors will look great.";
  }

  return hashPick(seed, [
    hook ? `Okay ${hook} — yeah I'm into that.` : "Okay yeah that tracks.",
    "Yeah that helps — keeping going.",
    "Got it — building on that.",
  ]);
}

/** Reject interview-speak, empty hype, and our old template lines. */
function sanitizeWarmLine(
  raw: string,
  questionId: string,
  answer: string,
  priorInterview: InterviewTurn[] = []
): string {
  const t = raw.trim().replace(/^["']|["']$/g, "");
  const tooLong = t.length > 140;
  const soundsLikeAnalysis = ANALYSIS_RE.test(t);
  const tooManySentences = (t.match(/[.!?]/g)?.length ?? 0) > 2;
  const tooGeneric =
    GENERIC_HYPE_ONLY.test(t) ||
    TEMPLATE_ACK_RE.test(t) ||
    (!referencesAnswer(t, answer) && t.split(/\s+/).length < 6);
  const echoChunk = answer.trim().toLowerCase().slice(0, 22);
  const echoesOpening =
    echoChunk.length > 12 &&
    t.toLowerCase().startsWith("okay") &&
    t.toLowerCase().includes(echoChunk.slice(0, 16));

  if (
    !t ||
    tooLong ||
    soundsLikeAnalysis ||
    tooManySentences ||
    tooGeneric ||
    echoesOpening
  ) {
    return warmFromAnswer(questionId, answer, priorInterview);
  }
  return t;
}

/**
 * After every answer: one warm, personal reply — then the next question.
 * No filler ("Perfect.", "Love it.") as a second bubble.
 */
/** Cheap Step Flash reply — interview tweaks, post-build chat, etc. */
export async function chatReply(
  system: string,
  user: string,
  maxTokens = 140
): Promise<string> {
  if (!integrations.chatModel) return "";
  const { text } = await chatComplete(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.75, maxTokens, timeoutMs: 20_000 }
  );
  return text;
}

function interviewLlmReady(): boolean {
  return integrations.chatModel;
}

/** @deprecated Spine steps skip acks — use ackForAppablePick when they tap Let Appable pick. */
export async function interviewAck(
  prevAnswer: string,
  questionId: string,
  priorInterview: InterviewTurn[] = []
): Promise<string[]> {
  return ackForAppablePick(prevAnswer, questionId, priorInterview);
}

/** One-line echo after Let Appable pick — not a filler ack before every question. */
export function ackForAppablePick(
  resolvedAnswer: string,
  questionId: string,
  priorInterview: InterviewTurn[] = []
): string[] {
  const line = warmFromAnswer(questionId, resolvedAnswer, priorInterview).trim();
  return line ? [line] : [];
}

/** Suggestion pills — LLM reads full interview; no category templates. */
export async function interviewSuggestionsForStep(
  stepId: string,
  stepPrompt: string,
  interview: InterviewTurn[]
): Promise<string[]> {
  if (interviewLlmReady()) {
    return interviewAiSuggestions(stepId, stepPrompt, interview);
  }
  return [APPABLE_PICK];
}

/** Resolve "Let Appable pick" from full interview context. */
export async function interviewResolvePick(
  stepId: string,
  stepPrompt: string,
  interview: InterviewTurn[]
): Promise<string> {
  if (interviewLlmReady()) {
    const picked = await interviewAiRecommend(stepId, stepPrompt, interview);
    if (picked) return picked;
  }
  const { resolveInterviewAnswer } = await import("@/lib/interviewSuggestions");
  return resolveInterviewAnswer(stepId as import("@/lib/interviewFlow").InterviewStepId, APPABLE_PICK, interview);
}

/**
 * Synthesize the structured master build prompt the build engine consumes.
 * Uses the chat model when configured; otherwise a deterministic local builder.
 */
export async function generateMasterPrompt(
  interview: InterviewTurn[]
): Promise<MasterBuildPrompt> {
  const referencePath = isReferencePath(interview);
  const referenceApp = referencePath
    ? answerFor(interview, "reference_name").trim() || null
    : null;
  const twist = referencePath ? answerFor(interview, "twist").trim() : null;
  const idea = answerFor(interview, "idea");
  const { resolvedAudience, resolvedFeatures } = await import("./interviewPlan");
  const audienceRaw = referencePath ? (twist ?? "") : resolvedAudience(interview);
  const featuresRaw = referencePath ? "" : resolvedFeatures(interview);
  const appName = resolveAppName(interview);
  const vibe = resolveVibe(interview);
  const colors = resolveColors(answerFor(interview, "colors"), interview);

  const inferred = referencePath && referenceApp
    ? inferFromReference(referenceApp, twist ?? idea)
    : inferArchetypeFromInterview(idea, featuresRaw, audienceRaw);

  const dyn = dynamicInterviewContext(interview);
  const userFeatureText = referencePath ? (twist ?? idea) : featuresRaw;
  const features = mergeFeatureList(
    [...parseUserFeatures(userFeatureText), ...dyn.featureNotes],
    [...inferred.features]
  );
  const screens = inferred.screens;
  const layoutArchetype = inferred.archetype;
  const descriptionBase = referencePath
    ? `${twist || inferred.description} Built as an original ${inferred.archetype.replace(/-/g, " ")} app in Appable's design system.`
    : idea || inferred.description;
  const description = [descriptionBase, ...dyn.descriptionNotes].filter(Boolean).join(" ");

  const audience =
    audienceRaw ||
    "Everyday people who want something simple and beautiful.";

  if (integrations.planModel) {
    const { planChatComplete } = await import("@/lib/planChat");
    const { text: content } = await planChatComplete(
      [
        {
          role: "system",
          content:
            "Turn this app interview into a master build prompt as STRICT JSON with keys: " +
            "appName, description, audience, twist (string or null), features (array of 3 short strings), " +
            "layoutArchetype (one of: tracker-dashboard, swipe-cards, social-feed, chat-messaging, " +
            "marketplace-shop, booking-scheduling, content-library, habit-streak, journal-notes, " +
            "onboarding-heavy-utility), vibe (Cinematic|Minimal|Bold|Soft|Luxury), colors, " +
            "screens (array of 4-6 screen names), referenceApp (string or null). " +
            "CRITICAL: features MUST reflect what the user actually asked for — keep their phrasing from the interview. " +
            "description must incorporate their idea/twist AND every dynamic follow-up answer verbatim where possible. " +
            "Do NOT default to cooking/recipes unless the user explicitly described a food/cooking app. " +
            "NEVER use the referenced app's name as appName or copy its branding. " +
            "Use provided layoutArchetype when referencePath is true but OVERRIDE generic features with user text. JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            referencePath,
            referenceApp,
            twist,
            idea,
            audience,
            featuresRaw,
            appName,
            vibe,
            colors,
            layoutArchetype,
            features,
            screens,
            description,
            dynamicFollowUps: dyn,
            fullInterview: interview.map((t) => ({
              questionId: t.questionId,
              question: t.question,
              answer: t.answer,
            })),
          }),
        },
      ],
      { temperature: 0.3, maxTokens: 1800, timeoutMs: 90_000 }
    );
    const parsed = parseJsonFromText<MasterBuildPrompt>(content);
    if (parsed?.appName) return normalizeMasterPrompt(parsed);
  }

  return normalizeMasterPrompt({
    appName,
    description,
    audience,
    twist,
    features: [...features],
    layoutArchetype,
    vibe,
    colors,
    screens,
    referenceApp,
  });
}

/** ASO copy for the launch pack. */
export async function generateAso(
  prompt: MasterBuildPrompt
): Promise<NonNullable<LaunchAssets["aso"]>> {
  if (integrations.chatModel) {
    const { text: content } = await chatComplete(
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
  const hue = 8;

  if (integrations.imageGenModel) {
    try {
      const { generateImage } = await import("@/lib/deepinfra");
      const style = `${prompt.vibe.toLowerCase()}, ${prompt.colors}, Appable warm aesthetic, no text overlays`;
      const iconImgs = await generateImage({
        prompt: `App icon for ${prompt.appName}: ${prompt.description.slice(0, 120)}. ${style}. Square, centered symbol.`,
        size: "1024x1024",
      });
      const shots = await Promise.all(
        prompt.screens.slice(0, 4).map(async (screen, i) => {
          const imgs = await generateImage({
            prompt: `Mobile app screenshot: ${screen} screen for ${prompt.appName}. ${prompt.features.join(", ")}. ${style}. Portrait phone UI.`,
            size: "1024x1024",
          });
          return {
            url: imgs[0]?.dataUrl ?? gradientDataUri(hue + i * 6, screen),
            caption: screen,
          };
        })
      );
      return {
        screenshots: shots,
        icon: {
          url:
            iconImgs[0]?.dataUrl ??
            gradientDataUri(hue, prompt.appName.slice(0, 2).toUpperCase(), 256, 256),
        },
      };
    } catch (err) {
      console.error("[generateScreenshots] FLUX failed:", err);
    }
  }

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
  const hooks = [
    "POV: you just built your own app",
    `The ${prompt.vibe.toLowerCase()} app everyone's asking about`,
    "I made this in one afternoon (no code)",
  ];

  let heroImageUrl: string | undefined;
  if (integrations.imageGenModel) {
    try {
      const { generateImage } = await import("@/lib/deepinfra");
      const imgs = await generateImage({
        prompt: `Hero frame for ${prompt.appName} app promo: ${prompt.features[0]}. ${prompt.vibe} ${prompt.colors}. Portrait 9:16 mobile UI.`,
      });
      heroImageUrl = imgs[0]?.dataUrl;
    } catch {
      /* fall through to script-only ads */
    }
  }

  const ads = await Promise.all(
    hooks.map(async (hook, i) => {
      const script =
        `0-2s: ${hook}.\n` +
        `2-6s: Show ${prompt.features[i % prompt.features.length]} in action.\n` +
        `6-9s: "${prompt.appName} — ${prompt.description.slice(0, 40)}".\n` +
        `9-12s: CTA "Get it on the App Store".`;

      let spec = "9:16, 12s, captions on, trending audio, soft coral grade.";
      if (integrations.adVideoModel && heroImageUrl && i === 0) {
        try {
          const { generateSeedanceVideo } = await import("@/lib/fal");
          const video = await generateSeedanceVideo({
            prompt: `${hook}. ${prompt.appName}: ${prompt.features[0]}. Energetic, Appable coral aesthetic.`,
            imageUrl: heroImageUrl,
            aspectRatio: "9:16",
            duration: "12",
          });
          spec = `Video: ${video.videoUrl}`;
        } catch (err) {
          console.error("[generateVideoAds] Seedance failed:", err);
        }
      }

      return {
        title: `Ad ${i + 1}: ${hook}`,
        script,
        spec,
      };
    })
  );

  return ads;
}
