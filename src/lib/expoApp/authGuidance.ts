/** Shared copy — coach, checklist, and preview all recommend the same auth stack. */

export const AUTH_OAUTH_RECOMMENDATION =
  "For launch, offer **Continue with Google** and **Continue with Apple** (one tap, users trust it). " +
  "Email + password is fine for testing in the preview — Supabase handles all three.";

export const AUTH_OAUTH_SETUP_HINT =
  "Turn on Google & Apple under Supabase → Authentication → Providers. " +
  "Appable shows the buttons in your app; you paste OAuth keys from Google Cloud and Apple Developer once.";

export function authChecklistWhy(authInPreview: boolean): string {
  if (authInPreview) {
    return (
      "Sign-up and sign-in are in the preview (Google, Apple, and email). " +
      "Email works with your linked Supabase now — enable Google/Apple providers before App Store launch."
    );
  }
  return (
    "People need accounts that follow them across devices. " +
    "Ship with Google + Apple sign-in (best UX) plus email sign-up and sign-in as a fallback."
  );
}

export function authBrainstormPillPrompt(appName: string): string {
  return (
    `How should sign in work for ${appName}? ` +
    `I heard Google and Apple are best — walk me through it simply.`
  );
}

export function authBuildPillPrompt(appName: string): string {
  return `Add sign-up and sign-in to ${appName} with Continue with Google, Continue with Apple, and email.`;
}
