import { integrations } from "@/lib/config";
import { planChatComplete } from "@/lib/planChat";
import type { BrainstormTurn, InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import type { ProjectConnectorState } from "@/lib/connectors/registry";
import { wireSupabaseAuthInPreview } from "./applySupabasePreview";
import {
  formatRetrievedBuildContext,
  indexBuildContext,
  retrieveBuildContext,
  verifyBuildChange,
} from "./buildContext";
import { founderVoiceBlock } from "./founderVoice";
import type { ExpoAppModel } from "./types";
import { getStringAtPath, setStringAtPath } from "./tweakPaths";

const AUTH_DEBUG_RE =
  /\b(sign[\s-]?(?:in|up)|log[\s-]?in|auth|oauth)\b.*\b(not working|broken|fail|error|doesn'?t work|won'?t work|can'?t|issue|debug|fix)\b|\b(not working|broken|fail|error|doesn'?t work|won'?t work|can'?t|issue|debug|fix)\b.*\b(sign[\s-]?(?:in|up)|log[\s-]?in|auth)\b|\bcan'?t\s+(sign|log)\b/i;

const COMPLEX_BUILD_RE =
  /\b(add|put|move|append|insert|remove|create|new tab|new screen|new field|new button|section|wire|implement|integrate|connect|enable|fix|broken|not working|doesn'?t work|combine|attach|link)\b/i;

type KimiOp = { op: "set"; path: string; value: string };

type KimiBuildResponse = {
  reply?: string;
  ops?: KimiOp[];
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

function isAllowedKimiPath(path: string): boolean {
  return /^(flow\.|home\.|profile\.|onboarding\[\d+\]\.|tabScreens\.[^.]+\.items\[\d+\]\.)/.test(
    path
  );
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

function applyKimiOps(
  model: ExpoAppModel,
  ops: KimiOp[]
): { model: ExpoAppModel; applied: string[] } {
  let next = model;
  const applied: string[] = [];

  for (const op of ops) {
    if (op.op !== "set" || !op.path || typeof op.value !== "string") continue;
    if (!isAllowedKimiPath(op.path)) continue;
    const before = getStringAtPath(next, op.path);
    if (before === op.value) continue;
    const updated = setStringAtPath(next, op.path, op.value);
    if (getStringAtPath(updated, op.path) === op.value) {
      next = updated;
      applied.push(op.path);
    }
  }

  return { model: next, applied };
}

export type KimiBuildResult =
  | { kind: "applied"; model: ExpoAppModel; reply: string }
  | { kind: "clarify"; reply: string }
  | null;

async function kimiBuildOnce(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  message: string,
  retrievedBlock: string,
  supabaseConnected: boolean
): Promise<KimiBuildResult> {
  const system =
    `You are the BUILD agent for "${mp.appName}" — Cursor-style: read retrieved context, then edit the preview. ` +
    `${founderVoiceBlock(mp.appName)} ` +
    `Workflow: (1) find the right line/screen in retrieved context (2) apply ops (3) confirm in reply. ` +
    `Supabase connected: ${supabaseConnected}. ` +
    `Output STRICT JSON only:\n` +
    `{"reply":"one short sentence","ops":[{"op":"set","path":"...","value":"..."}],"ask":null}\n` +
    `Use "ask" when you need ONE clarifying question — do not guess. ` +
    `Only use paths listed under Editable lines. Never remove tabs. ` +
    `For auth/backend issues: explain in reply; wire UI only — never invent API keys.`;

  const { text } = await planChatComplete(
    [
      { role: "system", content: system },
      { role: "user", content: `${retrievedBlock}\n\nFounder request:\n${message.trim()}` },
    ],
    { temperature: 0.35, maxTokens: 2048, timeoutMs: 90_000 }
  );

  const parsed = parseJsonFromText<KimiBuildResponse>(text);
  if (!parsed) return null;

  if (parsed.ask?.trim()) {
    return { kind: "clarify", reply: parsed.ask.trim() };
  }

  const ops = (parsed.ops ?? []).filter(
    (o): o is KimiOp => o?.op === "set" && typeof o.path === "string"
  );

  if (!ops.length) {
    if (parsed.reply?.trim()) {
      return { kind: "clarify", reply: parsed.reply.trim() };
    }
    return null;
  }

  const { model: next, applied } = applyKimiOps(model, ops);
  if (!applied.length) {
    return parsed.reply?.trim()
      ? { kind: "clarify", reply: parsed.reply.trim() }
      : null;
  }

  const reply =
    parsed.reply?.trim() ||
    `Updated ${applied.length} field${applied.length === 1 ? "" : "s"} in the preview.`;
  return { kind: "applied", model: next, reply, changedPaths: applied };
}

type KimiBuildResultInternal = KimiBuildResult & { changedPaths?: string[] };

/** Kimi (BUILD_MODEL) — index → retrieve → reason → act → verify (like Cursor). */
export async function runKimiBuildAgent(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  message: string,
  options: {
    brainstormContext?: string;
    brainstormHistory?: BrainstormTurn[];
    brainstormSummary?: string;
    connectorState?: ProjectConnectorState;
    connectorNote?: string;
    interview?: InterviewTurn[];
  } = {}
): Promise<KimiBuildResult> {
  if (!integrations.planModel) return null;

  const supabaseConnected =
    Boolean(options.connectorState?.supabase) &&
    options.connectorState!.supabase!.status !== "disconnected";

  const chunks = indexBuildContext({
    model,
    mp,
    interview: options.interview,
    brainstormHistory: options.brainstormHistory,
    brainstormSummary: options.brainstormSummary,
    connectorNote: options.connectorNote ?? options.brainstormContext,
    connectorState: options.connectorState,
  });

  const retrieved = retrieveBuildContext(message, chunks);
  const retrievedBlock = formatRetrievedBuildContext(message, retrieved);

  let result = (await kimiBuildOnce(
    model,
    mp,
    message,
    retrievedBlock,
    supabaseConnected
  )) as KimiBuildResultInternal | null;

  if (!result) return null;

  if (result.kind === "applied" && result.changedPaths?.length) {
    const check = verifyBuildChange(message, model, result.model, result.changedPaths);
    if (!check.ok) {
      const retry = (await kimiBuildOnce(
        result.model,
        mp,
        `${message.trim()}\n\n(Previous edit failed verify: ${check.note}. Try a different path or value.)`,
        retrievedBlock,
        supabaseConnected
      )) as KimiBuildResultInternal | null;
      if (retry) result = retry;
    }
  }

  if (result.kind === "applied") {
    const { changedPaths: _, ...out } = result;
    return out;
  }
  return result;
}

/** Route to Kimi when the request is structural or smart copy didn't handle it. */
export function shouldEscalateToKimi(message: string, smartCopyHandled: boolean): boolean {
  const msg = message.trim();
  if (!msg || /^Applying from brainstorm:/i.test(msg)) return false;
  if (isAuthDebugRequest(msg)) return false;
  if (isComplexBuildRequest(msg)) return true;
  return !smartCopyHandled;
}
