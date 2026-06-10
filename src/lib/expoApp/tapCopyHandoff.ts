import type { BrainstormTurn, BuildPatchOp } from "@/lib/types";
import type { CompiledBuildHandoff } from "./compileBuildHandoff";
import { listEditableCopyFields } from "./previewCopyFields";
import { extractPreviewPathFromMessage } from "./tapEditScope";
import type { ExpoAppModel } from "./types";
import { getStringAtPath } from "./tweakPaths";

export type TapCopyTicket = {
  intent: string;
  where: string;
  path: string;
  from: string;
  to: string;
};

const TAP_EDIT_RE = /I'm looking at .+currently says/i;

export function isTapEditMessage(message: string): boolean {
  return TAP_EDIT_RE.test(message);
}

/** Parse tap-to-ask user message into intent / where / from / optional path. */
export function parseTapEditUserMessage(message: string): Partial<TapCopyTicket> | null {
  if (!isTapEditMessage(message)) return null;

  const intent =
    message.match(/^(.+?)\.\s*I'm looking at/i)?.[1]?.trim() ||
    message.match(/^(.+?)\s+I'm looking at/i)?.[1]?.trim() ||
    "Update copy";

  const where =
    message.match(/I'm looking at ([^.]+)\./i)?.[1]?.trim() ||
    message.match(/I'm looking at ([^.]+)/i)?.[1]?.trim() ||
    "preview copy";

  const from =
    message.match(/currently says\s+["']([^"']+)["']/i)?.[1]?.trim() ||
    message.match(/currently says\s+["']([^"']+)["']/i)?.[1]?.trim();

  const path = extractPreviewPathFromMessage(message) ?? undefined;

  if (!from) return null;

  return { intent, where, from, path };
}

/** Coach proposal: Replace it with / Use "…" */
export function parseCoachReplacement(coach: string): string | null {
  const patterns = [
    /replace it with:\s*["']([^"']+)["']/i,
    /replace with:\s*["']([^"']+)["']/i,
    /\buse\s+["']([^"']+)["']/i,
    /→\s*["']([^"']+)["']/i,
    /to\s+["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = coach.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

function rankPathByWhere(
  candidates: { path: string; screen: string; label: string }[],
  where: string
): string | null {
  const w = where.toLowerCase();
  const scored = candidates.map((c) => {
    let score = 0;
    if (/sign-?in|log-?in/.test(w) && (c.path.includes("signIn") || c.screen === "sign-in")) {
      score += 3;
    }
    if (/sign-?up|register/.test(w) && (c.path.includes("signUp") || c.screen === "sign-up")) {
      score += 3;
    }
    if (/role\s*picker|welcome/.test(w) && /welcomeSubtitle|welcomeTitle/.test(c.path)) {
      score += 4;
    }
    if (/welcome/.test(w) && /welcome|sign-?in|sign-?up/.test(`${c.path} ${c.screen}`)) {
      score += 2;
    }
    if (/role/.test(w) && c.path.includes("roles")) score += 3;
    if (/subtitle|subtext/.test(w) && /subtitle|description|subheadline/.test(c.label)) {
      score += 1;
    }
    if (/setup/.test(w) && c.screen === "setup") score += 2;
    if (/home/.test(w) && c.screen === "home") score += 2;
    if (/onboarding/.test(w) && c.screen.startsWith("onboarding")) score += 2;
    return { path: c.path, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score ? scored[0].path : candidates[0]?.path ?? null;
}

function resolvePathForTapEdit(
  model: ExpoAppModel,
  appName: string,
  from: string,
  where: string,
  explicitPath?: string
): string | null {
  if (explicitPath) {
    const current = getStringAtPath(model, explicitPath).trim();
    if (current) {
      return explicitPath;
    }
  }

  const needle = from.trim().toLowerCase();
  const fields = listEditableCopyFields(model, appName);
  const candidates = fields.filter((f) => {
    const v = f.value.toLowerCase();
    return v === needle || v.includes(needle) || needle.includes(v.slice(0, Math.min(v.length, 24)));
  });

  if (!candidates.length) return explicitPath ?? null;
  return rankPathByWhere(candidates, where) ?? candidates[0]!.path;
}

export function formatStructuredCopyHandoff(ticket: TapCopyTicket): string {
  return (
    `Applying from brainstorm:\n` +
    `• Intent: ${ticket.intent}\n` +
    `• Where: ${ticket.where}\n` +
    `• Path: ${ticket.path}\n` +
    `• Change: "${ticket.from}" → "${ticket.to}"`
  );
}

/** Find the tap-edit user turn paired with this coach reply. */
export function tapEditUserForCoach(
  history: BrainstormTurn[],
  userMessage?: string
): string | null {
  if (userMessage && isTapEditMessage(userMessage)) return userMessage;

  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn?.role === "user" && isTapEditMessage(turn.content)) {
      return turn.content;
    }
  }
  return null;
}

/** Build the 4-part ticket: intent, where, from → to at exact path. */
export function compileTapCopyHandoff(
  userMessage: string,
  coachText: string,
  model: ExpoAppModel,
  appName: string
): CompiledBuildHandoff | null {
  const tap = parseTapEditUserMessage(userMessage);
  const to = parseCoachReplacement(coachText);
  if (!tap?.from || !to) return null;

  const path = resolvePathForTapEdit(
    model,
    appName,
    tap.from,
    tap.where ?? "preview",
    tap.path
  );
  if (!path) return null;

  const ticket: TapCopyTicket = {
    intent: tap.intent ?? "Update copy",
    where: tap.where ?? "preview",
    path,
    from: tap.from,
    to,
  };

  const patch: BuildPatchOp = {
    path,
    value: to,
    label: ticket.where,
  };

  const applyPrompt = `Update preview copy at ${path}: change "${ticket.from}" to "${ticket.to}".`;

  return {
    displayPrompt: formatStructuredCopyHandoff(ticket),
    applyPrompt,
    patches: [patch],
    intent: "copy",
  };
}
