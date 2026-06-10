import { listEditableCopyFields } from "./previewCopyFields";
import type { ExpoAppModel } from "./types";
import { getStringAtPath, setStringAtPath } from "./tweakPaths";

export type RenamePair = { from: string; to: string };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function titleCaseWord(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** User wants to swap a name/word — not a checklist lecture. */
export function isRenameRequest(message: string): boolean {
  return parseRenamePair(message) !== null;
}

export function parseRenamePair(message: string): RenamePair | null {
  const m = message.trim();
  if (!m) return null;

  const patterns: RegExp[] = [
    /instead\s+of\s+["']?([^"']+?)["']?\s+make\s+it\s+(?:say\s+)?["']?([^"'.?!]+)["']?/i,
    /(?:make it say|say|use|change (?:it )?to)\s+(.+?)\s+instead\s+of\s+(.+?)$/i,
    /rename\s+(?:the\s+)?(?:app\s+)?(?:to\s+)?["']?([^"']+?)["']?\s+to\s+["']?([^"'.?!]+)["']?/i,
    /rename\s+(?:it\s+)?to\s+["']?([^"'.?!]+)["']?/i,
    /replace\s+["']?([^"']+?)["']?\s+with\s+["']?([^"'.?!]+)["']?/i,
  ];

  for (const re of patterns) {
    const hit = m.match(re);
    if (!hit?.[1]) continue;
    if (re.source.includes("rename") && hit[2] === undefined) {
      return { from: "", to: titleCaseWord(stripSayPrefix(hit[1]!)) };
    }
    const from = stripSayPrefix(hit[1]!.trim()).replace(/[.?!]+$/, "");
    const to = stripSayPrefix(hit[2]!.trim()).replace(/[.?!]+$/, "");
    if (from && to) return { from, to };
  }

  return null;
}

/** Drop a leading "say"/"it say" so "make it say X" yields the target text X. */
function stripSayPrefix(s: string): string {
  return s.trim().replace(/^(?:it\s+)?say\s+/i, "").trim();
}

function replaceInString(value: string, pair: RenamePair): string {
  const toWord = titleCaseWord(pair.to);
  if (pair.from) {
    return value.replace(new RegExp(escapeRegex(pair.from), "gi"), toWord);
  }
  return value;
}

/** Patch every preview string that contains the old name. */
export function applyAppRename(
  model: ExpoAppModel,
  pair: RenamePair,
  appName: string
): ExpoAppModel | null {
  let next = model;
  let changed = false;

  const fields = listEditableCopyFields(next, appName);
  for (const field of fields) {
    const needle = pair.from || appName;
    if (!field.value.toLowerCase().includes(needle.toLowerCase())) continue;

    let newVal = replaceInString(field.value, pair);
    if (/welcome\s+to/i.test(field.path) && pair.from && !/welcome\s+to/i.test(newVal)) {
      newVal = `Welcome to ${titleCaseWord(pair.to)}`;
    }

    if (newVal === field.value) continue;
    const updated = setStringAtPath(next, field.path, newVal);
    if (getStringAtPath(updated, field.path) === newVal) {
      next = updated;
      changed = true;
    }
  }

  const displayName = next.profile?.displayName ?? "";
  const nameNeedle = pair.from || appName;
  if (displayName.toLowerCase().includes(nameNeedle.toLowerCase())) {
    const newName = pair.from
      ? replaceInString(displayName, pair)
      : titleCaseWord(pair.to);
    if (newName !== displayName) {
      next = { ...next, profile: { ...next.profile, displayName: newName } };
      changed = true;
    }
  } else if (!pair.from && pair.to) {
    next = { ...next, profile: { ...next.profile, displayName: titleCaseWord(pair.to) } };
    changed = true;
  }

  if (!pair.from && pair.to) {
    const wt = getStringAtPath(next, "flow.welcomeTitle");
    const welcome = wt?.trim()
      ? replaceInString(wt, pair)
      : `Welcome to ${titleCaseWord(pair.to)}`;
    if (welcome !== wt) {
      const updated = setStringAtPath(next, "flow.welcomeTitle", welcome);
      if (getStringAtPath(updated, "flow.welcomeTitle") === welcome) {
        next = updated;
        changed = true;
      }
    }
  }

  return changed ? next : null;
}

/** True when the old name is gone from welcome + display name (or never was there). */
export function renameWasApplied(
  before: ExpoAppModel,
  after: ExpoAppModel,
  pair: RenamePair,
  appName: string
): boolean {
  const needle = (pair.from || appName).toLowerCase();
  const toNeedle = titleCaseWord(pair.to).toLowerCase();

  const welcome = getStringAtPath(after, "flow.welcomeTitle").toLowerCase();
  const display = (after.profile?.displayName ?? "").toLowerCase();

  const keyBlob = `${welcome} ${display}`;
  if (keyBlob.includes(needle)) return false;
  if (keyBlob.includes(toNeedle) || keyBlob.includes(pair.to.toLowerCase())) {
    return true;
  }

  // The rename target may have landed on a non-title field (e.g. a copy edit
  // phrased as "instead of X make it Y"). Accept it as applied when the target
  // text is now present somewhere it wasn't, or the model meaningfully changed.
  const beforeBlob = JSON.stringify(before).toLowerCase();
  const afterBlob = JSON.stringify(after).toLowerCase();
  if (afterBlob.includes(toNeedle) || afterBlob.includes(pair.to.toLowerCase())) {
    return true;
  }
  return beforeBlob.includes(needle) && afterBlob !== beforeBlob;
}
