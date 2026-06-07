/**
 * Web → Builder handoff helpers. The web mints a short-lived, single-use token
 * tied to the user's session + project; the Builder opens via a custom-protocol
 * deep link, reads the token, and exchanges it for the app context. This removes
 * the manual project-ID copy/paste entirely.
 */
import { appUrl, builderProtocol } from "@/lib/config";
import type { BuildTarget } from "@/lib/types";

/**
 * Deep link the "Open in Appable Builder" button points at. The desktop Builder
 * registers the `appable://` protocol; the token + api base let it call back.
 */
export function builderDeepLink(token: string, target: BuildTarget | null): string {
  const params = new URLSearchParams({ token, api: appUrl });
  if (target) params.set("target", target);
  return `${builderProtocol}://handoff?${params.toString()}`;
}

/** Web fallback shown if the protocol isn't registered yet (download Builder). */
export function handoffFallbackUrl(token: string): string {
  return `${appUrl}/handoff/${token}`;
}
