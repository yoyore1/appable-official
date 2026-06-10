import { integrations } from "@/lib/config";
import { buildChatComplete } from "@/lib/planChat";
import type { BrainstormTurn, InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import type { ProjectConnectorState } from "@/lib/connectors/registry";
import { wireSupabaseAuthInPreview } from "./applySupabasePreview";
import {
  enrichBuildUserMessage,
  formatBuildThreadForPrompt,
} from "./buildChatContext";
import {
  formatRetrievedBuildContext,
  indexBuildContext,
  retrieveBuildContext,
  verifyBuildChange,
} from "./buildContext";
import { buildExpandedRetrievalQuery } from "./buildRetrieve";
import {
  applyBuildOps,
  humanPathLabel,
  parseBuildOpsFromKimi,
  type AppliedBuildChange,
  type BuildOp,
} from "./buildOps";
import { formatHonestBuildReply } from "./buildReply";
import { founderVoiceBlock } from "./founderVoice";
import {
  formatPreviewBuildStateBlock,
  type PreviewBuildState,
} from "./previewBuildState";
import type { ExpoAppModel } from "./types";

const AUTH_DEBUG_RE =
  /\b(sign[\s-]?(?:in|up)|log[\s-]?in|auth|oauth)\b.*\b(not working|broken|fail|error|doesn'?t work|won'?t work|can'?t|issue|debug|fix)\b|\b(not working|broken|fail|error|doesn'?t work|won'?t work|can'?t|issue|debug|fix)\b.*\b(sign[\s-]?(?:in|up)|log[\s-]?in|auth)\b|\bcan'?t\s+(sign|log)\b/i;

const COMPLEX_BUILD_RE =
  /\b(add|put|move|append|insert|remove|create|new tab|new screen|new field|new button|section|wire|implement|integrate|connect|enable|fix|broken|not working|doesn'?t work|combine|attach|link|back button|owner.?only|dog walker|remove.*walker)\b/i;

type KimiBuildResponse = {
  reply?: string;
  ops?: unknown[];
  ask?: string | null;
};

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
        return null;
      }
    }
  }
  return null;
}

export function isAuthDebugRequest(message: string): boolean {
  return AUTH_DEBUG_RE.test(message.trim());
}

export function isComplexBuildRequest(message: string): boolean {
  return COMPLEX_BUILD_RE.test(message.trim());
}

/** Debug sign-in like an engineer — check wiring, fix what's missing, explain the rest. */
export function tryAuthDebugBuild(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  message: string,
  connectorState?: ProjectConnectorState
): { model: ExpoAppModel; reply: string } | { reply: string } | null {
  if (!isAuthDebugRequest(message)) return null;

  const supabaseConnected =
    Boolean(connectorState?.supabase) && connectorState!.supabase!.status !== "disconnected";

  if (!supabaseConnected) {
    return {
      reply:
        "Sign-in needs Supabase first — open **Connections → Connect Supabase**, then try email sign-in in the preview. " +
        "Google/Apple need extra provider setup after that.",
    };
  }

  let next = model;
  const fixes: string[] = [];
  const auth = model.flow?.auth;

  if (!auth?.enabled || !auth.liveSupabase) {
    const wired = wireSupabaseAuthInPreview(model, mp);
    next = wired.model;
    fixes.push(
      auth?.enabled
        ? "Linked the auth screen to live Supabase email sign-in"
        : "Added sign-up and sign-in to the preview with live Supabase email"
    );
  }

  const lines = [
    fixes.length ? `${fixes.join(". ")}.` : "Auth screens are already in the preview.",
    "**To test email:** open the preview → **Sign up** with a test email + password → then **Sign in**.",
  ];

  if ((model.flow?.roles?.length ?? 0) >= 2) {
    lines.push(
      "**Dual roles:** pick owner or walker on sign-up before Google/Apple/email if the role chips show."
    );
    lines.push(
      "**Flow order:** welcome → role picker → setup → auth. If you're stuck on an earlier screen, finish that first."
    );
  }

  lines.push(
    "**Google/Apple:** buttons show in preview but need provider URLs under Connections — use email for testing now."
  );
  lines.push("If it still fails, paste the exact error from the preview and I'll narrow it down.");

  const reply = lines.join("\n\n");
  return fixes.length ? { model: next, reply } : { reply };
}

export type KimiBuildResult =
  | { kind: "applied"; model: ExpoAppModel; reply: string }
  | { kind: "clarify"; reply: string }
  | null;

function buildOpsPromptBlock(): string {
  return (
    `Output STRICT JSON only:\n` +
    `{"reply":"optional short note","ops":[...],"ask":null}\n\n` +
    `Ops (combine as needed):\n` +
    `• {"op":"set","path":"flow.setupSubmitLabel","value":"..."} — copy on allowed paths\n` +
    `• {"op":"set","path":"home.sections[0].items[0].badge","value":"Open"} — status chip on walk listing cards\n` +
    `• {"op":"set","path":"home.sections[0].items[0].meta","value":"Brooklyn · near you"} — area on card\n` +
    `• {"op":"remove_role","role":"walker"} — remove a role from role picker + walker homes\n` +
    `• {"op":"owner_only"} — owner-only app (removes walker, cleans dual-sided copy)\n` +
    `• {"op":"enable_setup_back","label":"Back"} — back button on profile setup screen\n` +
    `• {"op":"disable_setup_back"} — hide setup back button\n\n` +
    `SETUP vs ONBOARDING: "Tell us about you" + form fields = flow.setup* (NOT onboarding[n]).\n` +
    `Onboarding carousel slides = onboarding[0], onboarding[1], … only.\n` +
    `Use "ask" ONLY when the request is truly ambiguous AND there is no Build thread to continue.\n` +
    `If the thread mentions status chips, walk listing cards, or Home tab UI — apply set ops on those cards, not role-picker copy.`
  );
}

type KimiBuildOnceResult =
  | { kind: "clarify"; reply: string }
  | { kind: "applied"; model: ExpoAppModel; applied: AppliedBuildChange[]; changedPaths: string[] }
  | null;

async function kimiBuildOnce(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  message: string,
  retrievedBlock: string,
  previewBlock: string,
  supabaseConnected: boolean,
  buildThreadBlock: string
): Promise<KimiBuildOnceResult> {
  const system =
    `You are the BUILD agent for "${mp.appName}" — Cursor-style: read context, apply ops, verify mentally.\n` +
    `${founderVoiceBlock(mp.appName)}\n` +
    `Supabase connected: ${supabaseConnected}.\n` +
    `When a Build thread is included, CONTINUE that exact task. ` +
    `Follow-ups like "yes", "whatever is best", "do it" mean execute the last plan — do not ask unrelated questions about roles or copy.\n` +
    buildOpsPromptBlock();

  const user = [
    previewBlock,
    buildThreadBlock,
    retrievedBlock,
    `Founder request:\n${message.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { text } = await buildChatComplete(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.35, maxTokens: 2048, timeoutMs: 90_000 }
  );

  const parsed = parseJsonFromText<KimiBuildResponse>(text);
  if (!parsed) return null;

  if (parsed.ask?.trim()) {
    return { kind: "clarify", reply: parsed.ask.trim() };
  }

  const ops = parseBuildOpsFromKimi(parsed.ops ?? []);
  if (!ops.length) {
    if (parsed.reply?.trim()) {
      return { kind: "clarify", reply: parsed.reply.trim() };
    }
    return null;
  }

  const { model: next, applied } = applyBuildOps(model, ops);
  const changedPaths = applied.filter((a) => a.path).map((a) => a.path!);

  if (!applied.length) {
    return {
      kind: "clarify",
      reply:
        parsed.reply?.trim() ||
        "Those edits didn't apply — double-check the path or try tapping the line in the preview.",
    };
  }

  return { kind: "applied", model: next, applied, changedPaths };
}

/** Kimi on Fireworks (Expo Build tab) — screen-aware index → retrieve → ops → honest verify. */
export async function runKimiBuildAgent(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  message: string,
  options: {
    brainstormContext?: string;
    brainstormHistory?: BrainstormTurn[];
    buildHistory?: BrainstormTurn[];
    brainstormSummary?: string;
    connectorState?: ProjectConnectorState;
    connectorNote?: string;
    interview?: InterviewTurn[];
    previewState?: PreviewBuildState;
  } = {}
): Promise<KimiBuildResult> {
  if (!integrations.expoBuildModel) return null;

  const supabaseConnected =
    Boolean(options.connectorState?.supabase) &&
    options.connectorState!.supabase!.status !== "disconnected";

  const chunks = indexBuildContext({
    model,
    mp,
    interview: options.interview,
    brainstormHistory: options.brainstormHistory,
    buildHistory: options.buildHistory,
    brainstormSummary: options.brainstormSummary,
    connectorNote: options.connectorNote ?? options.brainstormContext,
    connectorState: options.connectorState,
  });

  const buildHistory = options.buildHistory ?? [];
  const enrichedMessage = enrichBuildUserMessage(message, buildHistory);
  const retrievalQuery = buildExpandedRetrievalQuery(message, buildHistory);
  const buildThreadBlock = formatBuildThreadForPrompt(buildHistory);

  const retrieved = retrieveBuildContext(message, chunks, {
    buildHistory,
    topK: 18,
  });
  const retrievedBlock = formatRetrievedBuildContext(
    retrievalQuery,
    retrieved,
    buildHistory
  );
  const previewBlock = formatPreviewBuildStateBlock(options.previewState, model);

  let attempt = await kimiBuildOnce(
    model,
    mp,
    enrichedMessage,
    retrievedBlock,
    previewBlock,
    supabaseConnected,
    buildThreadBlock
  );

  if (!attempt) return null;
  if (attempt.kind === "clarify") return attempt;

  let { model: next, applied, changedPaths } = attempt;

  if (changedPaths.length) {
    const check = verifyBuildChange(message, model, next, changedPaths);
    if (!check.ok) {
      const retry = await kimiBuildOnce(
        next,
        mp,
        `${enrichedMessage.trim()}\n\n(Previous edit failed verify: ${check.note}. Fix using the user's CURRENT screen.)`,
        retrievedBlock,
        previewBlock,
        supabaseConnected,
        buildThreadBlock
      );
      if (retry?.kind === "clarify") return retry;
      if (retry?.kind === "applied") {
        next = retry.model;
        applied = retry.applied;
        changedPaths = retry.changedPaths;
      }
    }
  }

  const reply = formatHonestBuildReply(applied);
  return { kind: "applied", model: next, reply };
}

/** Route to Kimi when the request is structural or smart copy didn't handle it. */
export function shouldEscalateToKimi(message: string, smartCopyHandled: boolean): boolean {
  const msg = message.trim();
  if (!msg || /^Applying from brainstorm:/i.test(msg)) return false;
  if (isAuthDebugRequest(msg)) return false;
  if (isComplexBuildRequest(msg)) return true;
  return !smartCopyHandled;
}

const LISTING_STATUS_CYCLE = ["Open", "Matched", "Done"] as const;

const LISTING_AREA_SAMPLES = [
  "Brooklyn · near you",
  "Manhattan · 0.8 mi",
  "Park Slope · near you",
  "Williamsburg · 1.2 mi",
  "Upper West Side · 0.5 mi",
  "Chelsea · near you",
] as const;

function isListingStatusChipRequest(message: string): boolean {
  const m = message.toLowerCase();
  return (
    /status chip|colored chip|three simple states|open.{0,24}matched|matched.{0,24}done/.test(
      m
    ) ||
    (/listing card|walk card|walk listing|home tab/.test(m) &&
      /chip|badge|status|open|matched|done/.test(m))
  );
}

function isListingAreaLabelRequest(message: string): boolean {
  const m = message.toLowerCase();
  if (isListingStatusChipRequest(message)) return false;
  return (
    /area label|neighborhood|distance|miles?.away|near you|leaving distance blank|zip code|geo/.test(
      m
    ) &&
    /listing card|walk card|walk listing|home tab|each.*card|preview/.test(m)
  );
}

/** Set neighborhood / area meta on every Home walk listing card (no LLM). */
export function tryListingAreaLabelOps(
  model: ExpoAppModel,
  message: string
): KimiBuildResult | null {
  if (!isListingAreaLabelRequest(message)) return null;

  const ops: BuildOp[] = [];
  let cardIndex = 0;
  for (let si = 0; si < model.home.sections.length; si++) {
    const section = model.home.sections[si];
    if (!section) continue;
    for (let ii = 0; ii < section.items.length; ii++) {
      const meta = LISTING_AREA_SAMPLES[cardIndex % LISTING_AREA_SAMPLES.length]!;
      ops.push({
        op: "set",
        path: `home.sections[${si}].items[${ii}].meta`,
        value: meta,
      });
      cardIndex++;
    }
  }

  if (!ops.length) return null;

  const { model: next, applied } = applyBuildOps(model, ops);
  if (!applied.length) return null;

  return {
    kind: "applied",
    model: next,
    reply:
      `Added neighborhood area labels on ${applied.length} walk listing ` +
      `card${applied.length === 1 ? "" : "s"} on Home — check the preview.`,
  };
}

/** Set Open / Matched / Done badges on every Home walk listing card (no LLM). */
export function tryListingStatusChipOps(
  model: ExpoAppModel,
  message: string
): KimiBuildResult | null {
  if (!isListingStatusChipRequest(message)) return null;

  const ops: BuildOp[] = [];
  let cardIndex = 0;
  for (let si = 0; si < model.home.sections.length; si++) {
    const section = model.home.sections[si];
    if (!section) continue;
    for (let ii = 0; ii < section.items.length; ii++) {
      const badge = LISTING_STATUS_CYCLE[cardIndex % LISTING_STATUS_CYCLE.length]!;
      ops.push({
        op: "set",
        path: `home.sections[${si}].items[${ii}].badge`,
        value: badge,
      });
      cardIndex++;
    }
  }

  if (!ops.length) return null;

  const { model: next, applied } = applyBuildOps(model, ops);
  if (!applied.length) return null;

  return {
    kind: "applied",
    model: next,
    reply:
      `Added Open, Matched, and Done status chips on ${applied.length} walk listing ` +
      `card${applied.length === 1 ? "" : "s"} on Home — check the preview.`,
  };
}

/** Remove a bottom tab (cart, shop, etc.) from preview + workspace JSON. */
export function tryRemoveTabOps(model: ExpoAppModel, message: string): KimiBuildResult | null {
  const m = message.toLowerCase();
  if (!/\b(remove|delete|hide|drop|strip)\b/.test(m)) return null;
  if (!/\b(cart|shop|tab|bag)\b/.test(m)) return null;

  const match = model.tabs.find((t) =>
    /cart|shop|bag/i.test(`${t.id} ${t.label}`)
  );
  if (!match) {
    return {
      kind: "clarify",
      reply: "I don't see a Cart or Shop tab in your app — which tab should I remove?",
    };
  }

  const next: ExpoAppModel = {
    ...model,
    tabs: model.tabs.filter((t) => t.id !== match.id),
    tabScreens: Object.fromEntries(
      Object.entries(model.tabScreens).filter(([id]) => id !== match.id)
    ),
  };

  return {
    kind: "applied",
    model: next,
    reply: `Removed the ${match.label} tab from your app.`,
  };
}

/** Deterministic fast-path for common structural requests (no LLM). */
export function tryDeterministicBuildOps(
  model: ExpoAppModel,
  message: string,
  previewState?: PreviewBuildState
): KimiBuildResult | null {
  const statusChips = tryListingStatusChipOps(model, message);
  if (statusChips) return statusChips;

  const areaLabels = tryListingAreaLabelOps(model, message);
  if (areaLabels) return areaLabels;

  const removeTab = tryRemoveTabOps(model, message);
  if (removeTab?.kind === "applied") return removeTab;

  const m = message.toLowerCase();
  const ops: BuildOp[] = [];

  if (
    /\b(owner.?only|only\s+dog\s+owner|no\s+dog\s+walker|remove.*walker|strip.*walker|without\s+walker)\b/i.test(
      m
    )
  ) {
    ops.push({ op: "owner_only" });
  }

  if (/\bback\s+button\b/i.test(m) && (previewState?.launchPhase === "setup" || /\bsetup\b/i.test(m))) {
    ops.push({ op: "enable_setup_back", label: "Back" });
  }

  if (!ops.length) return null;

  const { model: next, applied } = applyBuildOps(model, ops);
  if (!applied.length) return null;

  return {
    kind: "applied",
    model: next,
    reply: formatHonestBuildReply(applied),
  };
}

export { humanPathLabel };
