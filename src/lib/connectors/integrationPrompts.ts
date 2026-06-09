import type { MasterBuildPrompt } from "@/lib/types";
import { founderVoiceBlock } from "@/lib/expoApp/founderVoice";
import { eventCatalogForProject } from "@/lib/insights/eventCatalog";
import { integrationCredentialGuide } from "./credentialTiers";
import type { ConnectorId } from "./catalog";
import { getConnectorDefinition } from "./registry";

export interface IntegrationChatPrompts {
  explain: string;
  build: string;
}

function appLabel(mp?: MasterBuildPrompt, fallback = "my app"): string {
  return mp?.appName?.trim() || fallback;
}

const PROMPTS: Record<ConnectorId, IntegrationChatPrompts> = {
  supabase: {
    explain:
      "How does Supabase fit {app}? Walk me through accounts, database, and what I'd store — specific to this app, not generic backend advice.",
    build:
      "Wire Supabase auth in the preview for {app}: sign-up, sign-in, and profile rows. Keep it aligned with our existing tabs and roles.",
  },
  revenuecat: {
    explain:
      "We're adding RevenueCat to {app}. Explain how subscriptions or in-app purchases would work for our users, what to gate, and how it pairs with Supabase.",
    build:
      "Implement the paywall and subscription UX for {app} in the preview — premium gates, restore purchases UI, and copy that matches our app. RevenueCat is connected.",
  },
  railway: {
    explain:
      "When would {app} need Railway on top of Supabase? What custom API or background jobs fit our feature set?",
    build:
      "Wire {app} preview and config to call our Railway API URL for the features that need a custom server — show realistic request/response in the UI where it matters.",
  },
  posthog: {
    explain:
      "How should PostHog analytics fit {app}? Which events, funnels, and screens matter for our specific product — not a generic analytics lecture.",
    build:
      "Add PostHog to {app}: instrument the key screens and user actions we already have (tabs, sign-up, core flows). Keys are in Integrations — use our real screen names.",
  },
  sentry: {
    explain:
      "How should Sentry fit {app} before launch? What errors and performance issues should we watch for in this type of app?",
    build:
      "Wire Sentry for {app} in the Expo project config and error boundaries on main screens. DSN is in Integrations — no keys in chat.",
  },
  branch: {
    explain:
      "How would Branch deep links work for {app}? Share links, invites, and deferred deep links that match our actual user flows.",
    build:
      "Implement Branch deep link handling for {app}: universal links for share/invite flows that match our tabs and onboarding.",
  },
  appfollow: {
    explain:
      "How does AppFollow help {app} at launch? ASO, review alerts, and what we should monitor for this category.",
    build:
      "Document in {app} where AppFollow review monitoring hooks in (settings or launch checklist) and any in-app links to ASO assets we already have.",
  },
  onesignal: {
    explain:
      "What push notifications should {app} send, and when? Map them to our real features — not generic marketing blasts.",
    build:
      "Add OneSignal push setup for {app}: permission prompt UX, notification preferences in Profile, and wire user id when Supabase auth exists.",
  },
  appsflyer: {
    explain:
      "Does {app} need AppsFlyer attribution? Which campaigns or invite flows would we measure?",
    build:
      "Integrate AppsFlyer for {app}: install attribution and deep link callbacks aligned with our onboarding and invite flows.",
  },
  superwall: {
    explain:
      "How would Superwall paywall experiments work with RevenueCat in {app}? What would we A/B test first?",
    build:
      "Wire Superwall paywalls for {app} on top of RevenueCat entitlements — show the right offer screens on our premium gates.",
  },
  admob: {
    explain:
      "Where would ads fit in {app} without ruining UX? Banner vs rewarded — specific to our screens.",
    build:
      "Add AdMob placements for {app} in sensible spots (e.g. feed footer or rewarded unlock) using our connected ad unit IDs — keep core flows clean.",
  },
  stream: {
    explain:
      "Stream vs our current messaging for {app} — when is production chat worth it and how would channels map to owners/walkers or our roles?",
    build:
      "Integrate Stream Chat for {app} messaging UI if we use Stream — channels, composer, and thread list matching our Messages tab pattern.",
  },
  crisp: {
    explain:
      "Where should in-app support via Crisp live in {app}? Help entry points and what users would ask at each stage.",
    build:
      "Add Crisp support chat entry in {app} Profile or Help — match our theme and show the widget on support-related settings rows.",
  },
  "apple-sign-in": {
    explain:
      "Do we need Sign in with Apple for {app} before the App Store? Walk me through timing and Supabase setup.",
    build:
      "Ensure Sign in with Apple button and flow in {app} auth screens match Apple HIG; OAuth is configured in Supabase per Connections guide.",
  },
  "google-sign-in": {
    explain:
      "How does Google Sign In fit {app} for our audience? When to enable it vs email-only.",
    build:
      "Wire Continue with Google on {app} sign-in/sign-up screens; Supabase OAuth is the backend — follow Connections setup.",
  },
  "app-store-connect": {
    explain:
      "What do we need from App Store Connect API for {app} — TestFlight, metadata, and release checklist?",
    build:
      "Add launch checklist items and any export notes for {app} App Store Connect API keys we connected — no secrets in chat.",
  },
  "eas-build": {
    explain:
      "How does EAS Build fit our ship plan for {app}? iOS vs Android, and what we run locally vs cloud.",
    build:
      "Document EAS project linkage for {app} in handoff/export config using connected Expo token and project ID.",
  },
  github: {
    explain:
      "How should GitHub fit {app} — repo structure, CI, and how Appable export syncs?",
    build:
      "Ensure {app} export and README reference the connected GitHub repo; no tokens in generated client code.",
  },
};

const PLAYBOOKS: Partial<Record<ConnectorId, string>> = {
  supabase:
    "SUPABASE: expo + @supabase/supabase-js; anon key in app, RLS on tables; auth session in SecureStore; profiles table keyed to auth.users; wire preview sign-in to live client when connected.",
  revenuecat:
    "REVENUECAT: react-native-purchases; offerings → paywall UI; entitlements gate premium tabs; webhook → Supabase appable_subscriptions; never hardcode prices in prose only — show meta from products.",
  railway:
    "RAILWAY: fetch() to serviceUrl for custom endpoints; env EXPO_PUBLIC_API_URL; no secrets in client if endpoint needs server auth.",
  posthog:
    "POSTHOG: posthog-react-native; capture screen views on tab change; custom events on primary CTAs; host + apiKey from integrations.sdk.posthog.",
  sentry:
    "SENTRY: @sentry/react-native in app entry; DSN from integrations.sdk.sentry; wrap root; tag release with app version.",
  branch:
    "BRANCH: react-native-branch; handle deep link → navigate tab; live key in native config; test with branch test links.",
  onesignal:
    "ONESIGNAL: onesignal-expo-plugin; permission after onboarding; external_id = supabase user id when authed; appId from integrations.",
  appsflyer:
    "APPSFLYER: appsflyer-react-native-plugin; dev key + app id; onInstallConversionData for invite attribution.",
  superwall:
    "SUPERWALL: superwall-react-native; register with RevenueCat user id; placements on premium features.",
  admob:
    "ADMOB: react-native-google-mobile-ads; app id in app.json; banner on non-critical screens only.",
  stream:
    "STREAM: stream-chat-expo; channel per conversation; replace mock threads when Stream connected; token from backend.",
  crisp:
    "CRISP: crisp-sdk-web or native widget; websiteId only in client; open from Profile → Help.",
  "google-sign-in":
    "GOOGLE AUTH: Supabase signInWithOAuth({ provider: 'google' }); redirect URLs in Supabase dashboard; button on auth screen.",
  "apple-sign-in":
    "APPLE AUTH: Supabase Apple provider + expo-apple-authentication on iOS; required for App Store if other social logins exist.",
};

function fill(template: string, appName: string): string {
  return template.replace(/\{app\}/g, appName);
}

/** Where founders sign up — surfaced in explain prompts and coach playbooks. */
const ACCOUNT_SETUP: Partial<Record<ConnectorId, string>> = {
  supabase: "supabase.com",
  revenuecat: "revenuecat.com",
  railway: "railway.app",
  posthog: "posthog.com",
  sentry: "sentry.io",
  branch: "branch.io",
  appfollow: "appfollow.io",
  onesignal: "onesignal.com",
  appsflyer: "appsflyer.com",
  superwall: "superwall.com",
  admob: "apps.admob.com (Google account)",
  stream: "getstream.io",
  crisp: "crisp.chat",
  "apple-sign-in": "developer.apple.com (Apple Developer Program)",
  "google-sign-in": "console.cloud.google.com",
  "app-store-connect": "appstoreconnect.apple.com",
  "eas-build": "expo.dev",
  github: "github.com",
};

function explainAccountSuffix(id: ConnectorId): string {
  const def = getConnectorDefinition(id);
  const site = ACCOUNT_SETUP[id];
  const account =
    site
      ? ` Start with whether I need to create a ${def.displayName} account or log in at ${site}, then where to copy API keys and paste them in Integrations.`
      : ` Tell me whether I need to create an account or log in, where to get keys, and where to paste them in Integrations.`;
  return `${account} I'm the founder building the app — focus on product levers and platform ROI, not advice for end-users inside the app. Explain app keys vs Reports keys: ${integrationCredentialGuide(id).replace(/\n/g, " ")}`;
}

export function integrationAccountSetupHint(id: ConnectorId): string | null {
  const def = getConnectorDefinition(id);
  const site = ACCOUNT_SETUP[id];
  if (!site) return null;
  return `Create a ${def.displayName} account or sign in at ${site}; keys are pasted in Integrations (encrypted on export).`;
}

export function integrationExplainPrompt(
  id: ConnectorId,
  mp?: MasterBuildPrompt
): string {
  const appName = appLabel(mp);
  const hit = PROMPTS[id];
  const base = hit
    ? fill(hit.explain, appName)
    : (() => {
        const def = getConnectorDefinition(id);
        return `How does ${def.displayName} fit ${appName}? Explain specifically for our app and users — what to connect first and what it unlocks.`;
      })();
  return `${base}${explainAccountSuffix(id)}`;
}

export function integrationBuildPrompt(
  id: ConnectorId,
  mp?: MasterBuildPrompt
): string {
  const appName = appLabel(mp);
  const hit = PROMPTS[id];
  let base = hit ? fill(hit.build, appName) : null;
  if (!base) {
    const def = getConnectorDefinition(id);
    base = `Implement ${def.displayName} for ${appName} in the preview and export config. Keys are in Integrations — wire the real SDK pattern for Expo, matching our tabs and theme.`;
  }
  if (id === "posthog" && mp) {
    const { events, funnels } = eventCatalogForProject(mp);
    const eventIds = events.map((e) => e.id).join(", ");
    const funnel = funnels[0]?.steps.join(" → ") ?? "";
    return `${base} Track these events: ${eventIds}. Primary funnel: ${funnel}.`;
  }
  return base;
}

export function integrationChatPrompt(
  id: ConnectorId,
  mode: "brainstorm" | "build",
  mp?: MasterBuildPrompt
): string {
  return mode === "build" ? integrationBuildPrompt(id, mp) : integrationExplainPrompt(id, mp);
}

export function integrationPlaybook(id: ConnectorId, appName: string): string {
  const base = PLAYBOOKS[id];
  const def = getConnectorDefinition(id);
  if (base) return `${def.displayName} (${appName}): ${base}`;
  return `${def.displayName}: ${def.role} — use official Expo SDK; read keys from connectors.sdk.${id}; match ${appName} tabs and theme.`;
}

/** Coach + Build agent: how to implement each selected/connected integration. */
export function formatIntegrationPlaybooks(
  ids: ConnectorId[],
  appName: string
): string {
  const unique = [...new Set(ids)];
  if (!unique.length) return "";
  const accountLines = unique
    .map((id) => integrationAccountSetupHint(id))
    .filter((h): h is string => Boolean(h));
  const lines = [
    "INTEGRATION IMPLEMENTATION PLAYBOOKS (use when user asks about or added these):",
    ...unique.map((id) => `- ${integrationPlaybook(id, appName)}`),
    ...(accountLines.length
      ? [
          "ACCOUNT SETUP (mention when explaining any integration above):",
          ...accountLines.map((h) => `- ${h}`),
        ]
      : []),
    "- Never paste raw API keys in chat — they live in Integrations.",
    "- Brainstorm: explain fit for THIS app as the founder builds it; always say create account or log in + where to get keys. Build: change preview/codegen only for integrations on the project plan or connected.",
    `- ${founderVoiceBlock(appName)}`,
  ];
  return lines.join("\n");
}
