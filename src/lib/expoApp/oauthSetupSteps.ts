import type { SupabaseConnectorPublic } from "@/lib/types";

export type OAuthProvider = "google" | "apple";

export interface OAuthSetupStep {
  title: string;
  body: string;
  copyLabel?: string;
  copyValue?: string;
  href?: string;
  hrefLabel?: string;
  /** Second link (e.g. docs + console) */
  href2?: string;
  href2Label?: string;
}

export function supabaseAuthCallbackUrl(connector: SupabaseConnectorPublic): string {
  return `${connector.url.replace(/\/$/, "")}/auth/v1/callback`;
}

export function supabaseProviderDashboardUrl(
  connector: SupabaseConnectorPublic,
  provider: OAuthProvider
): string {
  const name = provider === "google" ? "Google" : "Apple";
  return `https://supabase.com/dashboard/project/${connector.projectRef}/auth/providers?provider=${name}`;
}

export function googleSetupSteps(connector: SupabaseConnectorPublic): OAuthSetupStep[] {
  const callback = supabaseAuthCallbackUrl(connector);
  return [
    {
      title: "Open Supabase Google settings",
      body: "Turn Google on and leave this tab open — you'll paste keys here in step 4.",
      href: supabaseProviderDashboardUrl(connector, "google"),
      hrefLabel: "Open Google provider in Supabase",
    },
    {
      title: "Create Google login keys",
      body: "In Google Cloud → APIs & Services → Credentials → Create OAuth client (Web application).",
      href: "https://console.cloud.google.com/apis/credentials",
      hrefLabel: "Open Google Cloud credentials",
    },
    {
      title: "Add Supabase callback URL in Google",
      body: "Open your OAuth client → Authorized redirect URIs → paste the URL below (must match exactly):",
      copyLabel: "Redirect URI (paste in Google)",
      copyValue: callback,
      href: "https://console.cloud.google.com/apis/credentials",
      hrefLabel: "Open Google credentials (pick your OAuth client)",
      href2: "https://supabase.com/docs/guides/auth/social-login/auth-google",
      href2Label: "Supabase Google auth docs (callback URL reference)",
    },
    {
      title: "Paste keys into Supabase",
      body: "Copy Client ID and Client Secret from Google → paste into Supabase Google provider → Save.",
      href: supabaseProviderDashboardUrl(connector, "google"),
      hrefLabel: "Back to Supabase Google settings",
    },
    {
      title: "Test in Appable",
      body: "In the phone preview, tap Continue with Google. If it works, mark this checklist item Done.",
    },
  ];
}

export function appleSetupSteps(connector: SupabaseConnectorPublic): OAuthSetupStep[] {
  const callback = supabaseAuthCallbackUrl(connector);
  return [
    {
      title: "You need Apple Developer ($99/yr)",
      body: "Skip Apple until you're close to the App Store. Email + Google are enough for early testing.",
      href: "https://developer.apple.com/programs/enroll/",
      hrefLabel: "Apple Developer Program",
    },
    {
      title: "Open Supabase Apple settings",
      body: "Turn Apple on — you'll paste Services ID details here.",
      href: supabaseProviderDashboardUrl(connector, "apple"),
      hrefLabel: "Open Apple provider in Supabase",
    },
    {
      title: "Create Sign in with Apple (Apple Developer)",
      body: "Certificates, Identifiers & Profiles → Services IDs → configure Sign in with Apple for your app.",
      href: "https://developer.apple.com/account/resources/identifiers/list/serviceId",
      hrefLabel: "Apple Services IDs",
    },
    {
      title: "Add callback URL",
      body: "In your Services ID → Sign in with Apple → paste this as Return URL / redirect:",
      copyLabel: "Return URL (paste in Apple)",
      copyValue: callback,
      href: "https://developer.apple.com/account/resources/identifiers/list/serviceId",
      hrefLabel: "Open Apple Services IDs",
      href2: "https://supabase.com/docs/guides/auth/social-login/auth-apple",
      href2Label: "Supabase Apple auth docs (callback URL reference)",
    },
    {
      title: "Paste into Supabase & test",
      body: "Save in Supabase, then tap Continue with Apple in the Appable preview.",
      href: supabaseProviderDashboardUrl(connector, "apple"),
      hrefLabel: "Supabase Apple settings",
    },
  ];
}

export const OAUTH_EXPECTATIONS =
  "Google & Apple = one-tap login for real users. Your preview already shows the buttons. " +
  "Email still works for testing today — do Google when you're ready for beta testers (~20 min). " +
  "Do Apple before the App Store (needs paid Apple Developer account).";
