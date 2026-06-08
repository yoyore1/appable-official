import type { MasterBuildPrompt } from "@/lib/types";
import type { ExpoAppModel, ExpoAuthFlow } from "./types";
import { wantsAuthPreviewWork, wantsMessagingBackendWork } from "./applyMessagingPreview";

/** @deprecated use wantsAuthPreviewWork or wantsMessagingBackendWork */
export function wantsSupabasePreviewWork(message: string): boolean {
  return wantsAuthPreviewWork(message) || wantsMessagingBackendWork(message);
}

export { wantsAuthPreviewWork, wantsMessagingBackendWork };

/** Patch preview model so Build mode adds sign-up + sign-in (web preview). */
export function wireSupabaseAuthInPreview(
  model: ExpoAppModel,
  mp: MasterBuildPrompt
): { model: ExpoAppModel; reply: string } {
  const roles = model.flow?.roles ?? [];
  const dualSided = roles.length >= 2;
  const already = model.flow?.auth?.enabled;

  const auth: ExpoAuthFlow = {
    ...(already ? model.flow!.auth! : {}),
    enabled: true,
    liveSupabase: true,
    signUpTitle: `Join ${mp.appName}`,
    signUpSubtitle: dualSided
      ? "Google, Apple, or email — then pick owner or walker."
      : "Continue with Google or Apple — or use email to test.",
    submitLabel: "Sign up with email",
    signInTitle: `Welcome back to ${mp.appName}`,
    signInSubtitle: dualSided
      ? "Google, Apple, or email — returning owners and walkers."
      : "Continue with Google or Apple — or sign in with email.",
    signInSubmitLabel: "Sign in with email",
    captureName: true,
    captureRoleInSignUp: dualSided,
    showGoogleSignIn: true,
    showAppleSignIn: true,
  };

  const next: ExpoAppModel = {
    ...model,
    flow: {
      ...model.flow,
      auth,
      roles: model.flow?.roles,
      welcomeTitle: model.flow?.welcomeTitle,
      welcomeSubtitle: model.flow?.welcomeSubtitle,
      setupTitle: model.flow?.setupTitle,
      setupSubtitle: model.flow?.setupSubtitle,
      setupFields: model.flow?.setupFields,
    },
  };

  const reply = already
    ? `Sign-up and sign-in are already on the preview — Google, Apple, and email${dualSided ? " (+ role pick on sign-up)" : ""}. Use email to test; turn on Google/Apple providers before launch.`
    : dualSided
      ? "Done — sign-up and sign-in are on the preview: Google, Apple, and email with owner/walker on sign-up. Test with email now; enable Google/Apple in Supabase before the App Store."
      : "Done — sign-up and sign-in are on the preview with Google, Apple, and email. Test with email against your Supabase; enable Google/Apple providers when you launch.";

  return { model: next, reply };
}
