import { integrations } from "@/lib/config";
import { buildChatComplete } from "@/lib/planChat";
import { isPreviewModelTweakRequest } from "./brainstormGuidance";
import type { BrainstormTurn, InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import { extractCopyChangesFromCoach } from "./resolveBuildIntent";
import { isTapEditMessage, parseCoachReplacement } from "./tapCopyHandoff";
import { extractPreviewPathFromMessage, resolveTapEditScope } from "./tapEditScope";
import { indexBuildContext, topCopyTargetFromIndex, verifyBuildChange } from "./buildContext";
import { appendCoachContext, buildPreviewCoachContext } from "./previewCoachContext";
import { listEditableCopyFields, type PreviewCopyField } from "./previewCopyFields";
import type { ExpoAppModel } from "./types";
import { screenIdsForBuildState, type PreviewBuildState } from "./previewBuildState";
import { applyAppRename, parseRenamePair } from "./appRename";
import { BUILD_DONE_REPLY } from "./buildReply";
import { getStringAtPath, setStringAtPath } from "./tweakPaths";

export type SmartBuildCopyResult =
  | { kind: "applied"; model: ExpoAppModel; reply: string }
  | { kind: "clarify"; reply: string }
  | null;

type CopyTarget = PreviewCopyField;

const COPY_INTENT_RE =
  /\b(simpl|shorter|clearer|friendlier|warmer|wording|copy|title|subtitle|headline|description|welcome|screen|make it|change|rewrite|replace|update|text|line|cta|button|label|tagline|headline)\b/i;

const SCREEN_HINTS: { re: RegExp; screens: string[] }[] = [
  { re: /\b(first|1st|opening|launch|start)\s+screen\b|\bfirst screen\b/i, screens: ["welcome", "onboarding-0"] },
  { re: /\bwelcome\b/i, screens: ["welcome"] },
  { re: /\bonboarding\b/i, screens: ["onboarding"] },
  { re: /\brole\s*picker|choose\s+(your\s+)?role|pick\s+(your\s+)?role\b/i, screens: ["role"] },
  { re: /\b(sign[\s-]?in|log[\s-]?in)\b/i, screens: ["sign-in"] },
  { re: /\b(sign[\s-]?up|register|create\s+account)\b/i, screens: ["sign-up"] },
  { re: /\bsetup|profile\s+setup|wizard\b/i, screens: ["setup"] },
  { re: /\bhome\b/i, screens: ["home"] },
  { re: /\bprofile\b/i, screens: ["profile"] },
];

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function words(s: string): string[] {
  return norm(s).split(" ").filter((w) => w.length > 2);
}

function overlapScore(a: string, b: string): number {
  const aw = new Set(words(a));
  const bw = words(b);
  if (!aw.size || !bw.length) return 0;
  let hit = 0;
  for (const w of bw) {
    if (aw.has(w)) hit++;
  }
  return hit / Math.max(aw.size, bw.length);
}

/** Double-quoted strings only — single quotes break on contractions (I'm, it's). */
function quotedPhrases(msg: string): string[] {
  const out: string[] = [];
  const re = /"([^"]{4,})"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(msg))) out.push(m[1]!.trim());
  return out;
}

function explicitReplacementInMessage(msg: string): string | null {
  if (/^Applying from brainstorm:/i.test(msg)) return parseCoachReplacement(msg);
  if (!/replace it with|replace with:|\buse\s+["']/i.test(msg)) return null;
  return parseCoachReplacement(msg);
}

export { listEditableCopyFields } from "./previewCopyFields";

function screenBoost(msg: string, target: CopyTarget): number {
  let boost = 0;
  for (const hint of SCREEN_HINTS) {
    if (!hint.re.test(msg)) continue;
    if (hint.screens.some((s) => target.screen === s || target.screen.startsWith(s))) {
      boost += 0.35;
    }
  }
  if (/\btitle\b/i.test(msg) && /title|headline|label/.test(target.label)) boost += 0.15;
  if (/\bsubtitle|subtext|description\b/i.test(msg) && /subtitle|description|subheadline/.test(target.label)) {
    boost += 0.15;
  }
  return boost;
}

function rankTargets(
  msg: string,
  targets: CopyTarget[],
  previewState?: PreviewBuildState
): CopyTarget[] {
  const activeScreens = new Set(screenIdsForBuildState(previewState));
  const nMsg = norm(msg);
  const quotes = quotedPhrases(msg);

  return targets
    .map((target) => {
      const nVal = norm(target.value);
      let score = overlapScore(msg, target.value) + screenBoost(msg, target);

      if (nVal.length >= 8 && nMsg.includes(nVal)) score += 0.9;
      if (nVal.length >= 8 && nVal.includes(nMsg.slice(0, Math.min(nMsg.length, 40)))) score += 0.5;

      for (const q of quotes) {
        const nq = norm(q);
        if (nq && (nVal.includes(nq) || nq.includes(nVal))) score += 0.85;
        score += overlapScore(q, target.value) * 0.5;
      }

      for (const w of words(target.value)) {
        if (w.length >= 5 && nMsg.includes(w)) score += 0.08;
      }

      if (activeScreens.size && activeScreens.has(target.screen)) score += 0.55;
      if (previewState?.focusedPath === target.path) score += 0.9;

      return { target, score };
    })
    .filter((r) => r.score >= 0.22)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.target);
}

function rewriteTask(message: string): string {
  const m = message.toLowerCase();
  if (/simpl|easier|plain/.test(m)) return "Make it simpler — fewer words, same meaning.";
  if (/shorter|brief|concise/.test(m)) return "Make it shorter.";
  if (/clearer|clear/.test(m)) return "Make it clearer.";
  if (/friendlier|warmer/.test(m)) return "Make it warmer and friendlier.";
  if (/professional|polished/.test(m)) return "Make it more polished.";
  const toMatch = message.match(/\bto\s+["']([^"']+)["']/i);
  if (toMatch) return `Change it to: "${toMatch[1]!.trim()}"`;
  return `Apply what the founder asked: ${message}`;
}

function cleanLine(text: string): string {
  return (text.trim().split(/\n/)[0] ?? "").replace(/^["']|["']$/g, "").slice(0, 160);
}

async function rewriteCopy(
  mp: MasterBuildPrompt,
  coach: ReturnType<typeof buildPreviewCoachContext>,
  target: CopyTarget,
  message: string
): Promise<string> {
  const system = appendCoachContext(
    `You rewrite ONE line of copy for the mobile app "${mp.appName}". ` +
      `Screen: ${target.screen}. Field: ${target.label}. ` +
      `Output ONLY the new line — no quotes, labels, or explanation. Max 140 characters.`,
    coach
  );
  const user =
    `Current line:\n"${target.value}"\n\n` +
    `Founder request: ${message}\n\n` +
    `Task: ${rewriteTask(message)}\n\n` +
    `Write the new line only.`;

  // buildChatComplete falls back to the DeepInfra plan model when Fireworks
  // is absent, so only bail when neither model is configured.
  if (!integrations.expoBuildModel && !integrations.planModel) return "";

  const { text } = await buildChatComplete(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.7, maxTokens: 256, timeoutMs: 60_000 }
  );

  let next = cleanLine(text);
  if (!next || next.toLowerCase() === target.value.toLowerCase()) {
    const retry = await buildChatComplete(
      [
        { role: "system", content: system },
        { role: "user", content: `${user}\n\nReply with ONLY the rewritten line.` },
      ],
      { temperature: 0.65, maxTokens: 320, timeoutMs: 75_000 }
    );
    next = cleanLine(retry.text);
  }
  return next;
}

function tapScopeFromBrainstormHistory(
  history: BrainstormTurn[],
  model: ExpoAppModel,
  appName: string
) {
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn?.role === "user" && extractPreviewPathFromMessage(turn.content)) {
      return resolveTapEditScope(model, appName, turn.content);
    }
  }
  return null;
}

function tryInsteadOfReplacement(
  model: ExpoAppModel,
  message: string,
  appName: string
): SmartBuildCopyResult | null {
  const pair = parseRenamePair(message);
  if (!pair) return null;
  const renamed = applyAppRename(model, pair, appName);
  if (!renamed) return null;
  return { kind: "applied", model: renamed, reply: BUILD_DONE_REPLY };
}

function lastCoachReply(history: BrainstormTurn[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.role === "assistant") return history[i]!.content;
  }
  return "";
}

function tryStructuredBrainstormHandoff(
  message: string,
  model: ExpoAppModel
): SmartBuildCopyResult | null {
  if (!/^Applying from brainstorm:/i.test(message)) return null;

  const path = message.match(/Path:\s*(\S+)/)?.[1];
  const change = message.match(/Change:\s*"(.+)"\s*→\s*"(.+)"/);
  if (path && change?.[2]) {
    const next = change[2].trim();
    const updated = setStringAtPath(model, path, next);
    if (getStringAtPath(updated, path) === next) {
      return {
        kind: "applied",
        model: updated,
        reply: BUILD_DONE_REPLY,
      };
    }
  }
  return null;
}

/** Instant apply when brainstorm coach already named exact copy changes. */
export function tryBrainstormCoachCopy(
  model: ExpoAppModel,
  message: string,
  brainstormHistory: BrainstormTurn[]
): SmartBuildCopyResult | null {
  const structured = tryStructuredBrainstormHandoff(message, model);
  if (structured) return structured;

  const coach = lastCoachReply(brainstormHistory);
  if (!coach.trim()) return null;

  const changes = extractCopyChangesFromCoach(coach, model);
  if (changes.length) {
    let next = model;
    const labels: string[] = [];
    for (const c of changes) {
      const updated = setStringAtPath(next, c.path, c.value);
      if (getStringAtPath(updated, c.path) === c.value) {
        next = updated;
        labels.push(c.desc);
      }
    }
    if (labels.length) {
      return {
        kind: "applied",
        model: next,
        reply: BUILD_DONE_REPLY,
      };
    }
  }

  const quoted = parseCoachReplacement(coach);
  if (!quoted) return null;

  const ranked = rankTargets(
    `${message}\n${coach}`,
    listEditableCopyFields(model, model.profile?.displayName ?? "App")
  );
  const hit = ranked[0];
  if (!hit) return null;

  const updated = setStringAtPath(model, hit.path, quoted);
  if (getStringAtPath(updated, hit.path) !== quoted) return null;

  return {
    kind: "applied",
    model: updated,
    reply: BUILD_DONE_REPLY,
  };
}

/** Cursor-style: find the line the founder named, rewrite it, apply to preview. */
export async function trySmartBuildCopy(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  message: string,
  interview: InterviewTurn[] = [],
  brainstormHistory: BrainstormTurn[] = [],
  previewState?: PreviewBuildState
): Promise<SmartBuildCopyResult | null> {
  const msg = message.trim();
  if (!msg) return null;
  if (isPreviewModelTweakRequest(msg)) return null;

  const insteadOf = tryInsteadOfReplacement(model, msg, mp.appName);
  if (insteadOf) return insteadOf;

  const coachFast = tryBrainstormCoachCopy(model, msg, brainstormHistory);
  if (coachFast) return coachFast;

  const tapScope =
    resolveTapEditScope(model, mp.appName, msg) ??
    tapScopeFromBrainstormHistory(brainstormHistory, model, mp.appName);
  if (tapScope) {
    const direct = explicitReplacementInMessage(msg);
    if (direct) {
      const next = direct.trim();
      const updated = setStringAtPath(model, tapScope.path, next);
      if (getStringAtPath(updated, tapScope.path) === next) {
        return {
          kind: "applied",
          model: updated,
          reply: BUILD_DONE_REPLY,
        };
      }
    }
    if (isTapEditMessage(msg) && COPY_INTENT_RE.test(msg)) {
      const coach = buildPreviewCoachContext(mp, interview, model);
      const next = await rewriteCopy(mp, coach, tapScope.target, msg);
      if (next.trim() && next.trim().toLowerCase() !== tapScope.target.value.toLowerCase()) {
        const updated = setStringAtPath(model, tapScope.path, next.trim());
        if (getStringAtPath(updated, tapScope.path) === next.trim()) {
          return {
            kind: "applied",
            model: updated,
            reply: BUILD_DONE_REPLY,
          };
        }
      }
    }
  }

  if (!COPY_INTENT_RE.test(msg)) return null;

  const chunks = indexBuildContext({ model, mp, interview });
  const ranked = rankTargets(
    msg,
    listEditableCopyFields(model, mp.appName),
    previewState
  );
  const hitFromRank = ranked[0];
  const hitFromIndex = topCopyTargetFromIndex(msg, chunks);
  const hit = hitFromRank
    ? {
        path: hitFromRank.path,
        value: hitFromRank.value,
        screen: hitFromRank.screen,
        label: hitFromRank.label,
      }
    : hitFromIndex?.path && hitFromIndex.value
      ? {
          path: hitFromIndex.path,
          value: hitFromIndex.value,
          screen: hitFromIndex.screen,
          label: hitFromIndex.label,
        }
      : null;

  if (!hit?.path || !hit.value) {
    return {
      kind: "clarify",
      reply:
        "I couldn't find that line in the preview — which screen is it on? " +
        "(welcome / first screen, role picker, setup, sign-in, home, or onboarding)",
    };
  }

  const target = {
    path: hit.path,
    value: hit.value,
    screen: hit.screen,
    label: hit.label,
  };
  const coach = buildPreviewCoachContext(mp, interview, model);
  const next = await rewriteCopy(mp, coach, target, msg);

  if (!next.trim() || next.trim().toLowerCase() === target.value.toLowerCase()) {
    return {
      kind: "clarify",
      reply:
        `I found "${target.label}" on the ${target.screen} screen but couldn't rewrite it cleanly — ` +
        `what should it say instead?`,
    };
  }

  const updated = setStringAtPath(model, target.path, next.trim());
  if (getStringAtPath(updated, target.path) !== next.trim()) {
    return {
      kind: "clarify",
      reply: `That field isn't editable yet — try tapping the line in the preview, or name the screen more specifically.`,
    };
  }

  const verified = verifyBuildChange(msg, model, updated, [target.path]);
  if (!verified.ok) {
    return {
      kind: "clarify",
      reply: `I tried updating ${target.label} but it didn't stick — what should the new line say exactly?`,
    };
  }

  return {
    kind: "applied",
    model: updated,
    reply: BUILD_DONE_REPLY,
  };
}
