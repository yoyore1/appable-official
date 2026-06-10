import type { ExpoAppModel } from "./types";

export interface TapEditTarget {
  kind: "text" | "box" | "screen";
  id: string;
  path?: string;
}

export interface TapEditChange {
  text?: string;
  color?: string;
  background?: string;
}

function tokens(path: string): (string | number)[] {
  const out: (string | number)[] = [];
  const re = /([^.[\]]+)|\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path))) {
    if (m[2] !== undefined) out.push(Number(m[2]));
    else out.push(m[1]!);
  }
  return out;
}

function setAtPath(root: unknown, path: string, value: string): boolean {
  const toks = tokens(path);
  if (!toks.length) return false;
  let cur: unknown = root;
  for (let i = 0; i < toks.length - 1; i++) {
    if (cur == null || typeof cur !== "object") return false;
    cur = (cur as Record<string | number, unknown>)[toks[i]!];
  }
  if (cur == null || typeof cur !== "object") return false;
  const last = toks[toks.length - 1]!;
  if (!(last in (cur as Record<string | number, unknown>))) return false;
  (cur as Record<string | number, unknown>)[last] = value;
  return true;
}

/** Apply one tap-to-edit change to the model (content + per-element style). */
export function applyTapEdit(
  model: ExpoAppModel,
  target: TapEditTarget,
  change: TapEditChange
): { model: ExpoAppModel; changed: boolean } {
  const next: ExpoAppModel = JSON.parse(JSON.stringify(model));
  let changed = false;

  if (
    target.kind === "text" &&
    typeof change.text === "string" &&
    target.path
  ) {
    if (setAtPath(next, target.path, change.text)) changed = true;
  }

  const wantsColor = typeof change.color === "string" && change.color.trim();
  const wantsBg = typeof change.background === "string" && change.background.trim();

  if (wantsColor || wantsBg) {
    const styles = { ...(next.elementStyles ?? {}) };
    const prev = styles[target.id] ?? {};
    const entry = { ...prev };
    if (wantsColor) entry.color = change.color!.trim();
    if (wantsBg) entry.background = change.background!.trim();
    styles[target.id] = entry;
    next.elementStyles = styles;
    changed = true;
  }

  return { model: next, changed };
}
