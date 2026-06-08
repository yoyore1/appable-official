import fs from "node:fs";
import path from "node:path";
import { buildExpoGoDeepLink } from "@/lib/expoGoLink";
import { previewOriginFromRequest } from "@/lib/previewUrl";

const DEV_URL_FILE = path.join(process.cwd(), ".data", "expo-dev-url.json");

/** Metro / tunnel base from env or written by `npm run expo:dev`. */
export function readExpoDevServerUrl(): string | null {
  const fromEnv =
    process.env.NEXT_PUBLIC_EXPO_DEV_SERVER_URL ??
    process.env.EXPO_DEV_SERVER_URL;
  if (fromEnv?.trim()) return fromEnv.trim().replace(/\/$/, "");

  try {
    if (!fs.existsSync(DEV_URL_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(DEV_URL_FILE, "utf8")) as {
      url?: string;
      updatedAt?: string;
    };
    if (!raw.url) return null;
    const age = raw.updatedAt
      ? Date.now() - new Date(raw.updatedAt).getTime()
      : Infinity;
    if (age > 2 * 60 * 60 * 1000) return null;
    return raw.url.replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Deep link Expo Go opens — loads the shared shell with this project baked in. */
export function expoGoDeepLink(
  projectId: string,
  previewToken: string,
  devServerUrl?: string | null
): string | null {
  const base = devServerUrl ?? readExpoDevServerUrl();
  if (!base) return null;
  return buildExpoGoDeepLink(base, projectId, previewToken);
}

/** HTTPS API base the Expo shell on a phone should call (LAN in dev). */
export function apiBaseForExpoShell(
  requestHost?: string | null,
  requestProto?: string | null
): string {
  return previewOriginFromRequest(requestHost, requestProto);
}
