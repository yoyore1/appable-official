import type { ExpoAppModel } from "./types";

export function findTabId(model: ExpoAppModel, pattern: RegExp): string | null {
  const hit = model.tabs.find((t) => pattern.test(`${t.id} ${t.label}`));
  return hit?.id ?? null;
}
