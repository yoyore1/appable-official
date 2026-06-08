import { randomUUID } from "node:crypto";
import type { Project } from "@/lib/types";

export function mintExpoPreviewToken(): string {
  return randomUUID().replace(/-/g, "");
}

/** Ensure built projects have a phone-preview token for Expo Go fetches. */
export function projectExpoPreviewToken(project: Project): string | null {
  return project.expoPreviewToken ?? null;
}
