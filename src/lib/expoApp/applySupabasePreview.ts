import type { MasterBuildPrompt } from "@/lib/types";
import type { ExpoAppModel, ExpoAuthFlow } from "./types";

export function wantsSupabasePreviewWork(message: string): boolean {
  const m = message.toLowerCase();
  return (
    /supabase|firebase|backend|database|wire|auth|sign[\s-]?up|sign[\s-]?in|log[\s-]?in|create a user|has_completed_onboarding|onboarding flag|account|register/.test(
      m
    )
  );
}

/** Patch preview model so Build mode adds a real sign-up flow (web preview). */
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
    ? `Sign-up is already on the preview — Google, Apple, and email${dualSided ? " (+ role pick)" : ""}. Use email to test against your Supabase; turn on Google/Apple providers before launch.`
    : dualSided
      ? "Done — sign-up is on the preview: Google, Apple, and email with owner/walker. Test with email now; enable Google/Apple in Supabase before the App Store."
      : "Done — sign-up is on the preview with Google, Apple, and email. Test with email against your Supabase; enable Google/Apple providers when you launch.";

  return { model: next, reply };
}
