import type { ExpoAuthFlow } from "./types";

/** Sign-in fields are required whenever auth is enabled — backfill for older models. */
export function completeAuthFlow(
  auth: Partial<ExpoAuthFlow> & Pick<ExpoAuthFlow, "enabled" | "signUpTitle" | "submitLabel">,
  appName: string
): ExpoAuthFlow {
  return {
    captureName: auth.captureName ?? true,
    captureRoleInSignUp: auth.captureRoleInSignUp ?? false,
    liveSupabase: auth.liveSupabase,
    showGoogleSignIn: auth.showGoogleSignIn ?? true,
    showAppleSignIn: auth.showAppleSignIn ?? true,
    enabled: auth.enabled,
    signUpTitle: auth.signUpTitle,
    signUpSubtitle: auth.signUpSubtitle,
    submitLabel: auth.submitLabel,
    signInTitle: auth.signInTitle ?? `Welcome back to ${appName}`,
    signInSubtitle: auth.signInSubtitle ?? "Sign in with Google, Apple, or email.",
    signInSubmitLabel: auth.signInSubmitLabel ?? "Sign in with email",
  };
}
