import type { ExpoAppModel } from "./types";

export interface TweakTarget {
  path: string;
  label: string;
  field: string;
}

function parsePath(path: string): (string | number)[] {
  const parts: (string | number)[] = [];
  const re = /([^.\[\]]+)|\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path))) {
    if (m[1]) parts.push(m[1]);
    else if (m[2]) parts.push(Number(m[2]));
  }
  return parts;
}

function getParent(
  root: unknown,
  parts: (string | number)[]
): { parent: Record<string | number, unknown>; key: string | number } | null {
  if (parts.length < 1) return null;
  let cur: unknown = root;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string | number, unknown>)[parts[i]!];
  }
  if (cur == null || typeof cur !== "object") return null;
  return {
    parent: cur as Record<string | number, unknown>,
    key: parts[parts.length - 1]!,
  };
}

export function getStringAtPath(model: ExpoAppModel, path: string): string {
  const parts = parsePath(path);
  let cur: unknown = model;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return "";
    cur = (cur as Record<string | number, unknown>)[p];
  }
  return typeof cur === "string" ? cur : "";
}

export function setStringAtPath(
  model: ExpoAppModel,
  path: string,
  value: string
): ExpoAppModel {
  const parts = parsePath(path);
  const hit = getParent(model, parts);
  if (!hit) return model;
  const next = structuredClone(model);
  const nextHit = getParent(next, parts);
  if (!nextHit) return model;
  nextHit.parent[nextHit.key] = value;
  return next;
}

/** Remove a list item at path like tabScreens.walks.items[2] */
export function removeAtPath(model: ExpoAppModel, path: string): ExpoAppModel {
  const itemMatch = path.match(/^(.+\.items)\[(\d+)\](?:\.\w+)?$/);
  if (!itemMatch) return model;
  const listPath = itemMatch[1]!;
  const index = Number(itemMatch[2]);
  const parts = parsePath(`${listPath}[${index}]`);
  const hit = getParent(model, parts);
  if (!hit || !Array.isArray(hit.parent[hit.key])) return model;
  const next = structuredClone(model);
  const listParts = parsePath(listPath);
  let listCur: unknown = next;
  for (const p of listParts) {
    listCur = (listCur as Record<string | number, unknown>)[p];
  }
  if (!Array.isArray(listCur)) return model;
  listCur.splice(index, 1);
  return next;
}

export function canRemovePath(path: string): boolean {
  return /\.items\[\d+\]/.test(path);
}

export function supportsImageSwap(path: string): boolean {
  return /\.items\[\d+\]/.test(path) || path.endsWith(".imageUrl");
}

/** Icons & photos — upload from device, not color tweaks. */
export function isMediaTarget(target: TweakTarget): boolean {
  if (target.field === "icon" || target.field === "image") return true;
  if (/\.emoji$/.test(target.path) || target.path.endsWith(".imageUrl")) return true;
  return supportsImageSwap(target.path);
}

export function isImageUrlValue(value: string): boolean {
  const v = value.trim();
  return v.startsWith("data:image/") || /^https?:\/\//i.test(v);
}

export function supportsAccentTweak(path: string): boolean {
  return /heroLabel|heroSublabel|primaryAction|accent/.test(path);
}

export function supportsColorTweak(path: string): boolean {
  return path.startsWith("theme.");
}

/** Opposite line on a role card (bold title vs gray description). */
export function rolePickerSiblingField(
  model: ExpoAppModel,
  path: string
): { path: string; label: string; value: string } | undefined {
  const m = path.match(/^flow\.roles\[(\d+)\]\.(label|description)$/);
  if (!m) return undefined;
  const index = Number(m[1]);
  const role = model.flow?.roles?.[index];
  if (!role) return undefined;
  if (m[2] === "label") {
    return {
      path: `flow.roles[${index}].description`,
      label: "Description",
      value: role.description ?? "",
    };
  }
  return {
    path: `flow.roles[${index}].label`,
    label: "Role title",
    value: role.label ?? "",
  };
}
