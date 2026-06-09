import type { ConnectorId } from "./catalog";

/** App = shipped in export. Reports = Appable-only (insights, dashboards, weekly pull). */
export type SdkFieldTier = "app" | "reports";

export interface SdkFieldSpec {
  id: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  required?: boolean;
  tier?: SdkFieldTier;
  /** Short normie explanation — why this key exists. */
  why?: string;
}

export interface SdkConnectorSpec {
  id: ConnectorId;
  dashboardUrl?: string;
  setupSteps: string[];
  fields: SdkFieldSpec[];
}

export const SDK_CONNECTOR_SPECS: Partial<Record<ConnectorId, SdkConnectorSpec>> = {
  posthog: {
    id: "posthog",
    dashboardUrl: "https://us.posthog.com/project/settings",
    setupSteps: [
      "Create a PostHog account or sign in at posthog.com (free tier works).",
      "Open your PostHog project → Settings → Project API key.",
      "Paste the API key and your project host (e.g. https://us.i.posthog.com).",
    ],
    fields: [
      {
        id: "apiKey",
        label: "Project API key",
        secret: true,
        required: true,
        tier: "app",
        why: "Sent with your app so PostHog receives events from real users.",
      },
      {
        id: "host",
        label: "API host",
        placeholder: "https://us.i.posthog.com",
        required: true,
        tier: "app",
        why: "Tells the SDK which PostHog region to send events to.",
      },
      {
        id: "personalApiKey",
        label: "Personal API key",
        secret: true,
        required: false,
        tier: "reports",
        why: "Lets Appable read funnels and build weekly Reports here — Profile → Personal API keys in PostHog.",
      },
    ],
  },
  sentry: {
    id: "sentry",
    dashboardUrl: "https://sentry.io/settings/projects/",
    setupSteps: [
      "Create a Sentry account or sign in at sentry.io.",
      "Create a project in Sentry → Client Keys (DSN).",
      "Paste the DSN — Appable injects it into your Expo app config on export.",
    ],
    fields: [
      {
        id: "dsn",
        label: "DSN",
        secret: true,
        required: true,
        tier: "app",
        why: "Shipped in your app so crashes are reported automatically.",
      },
      {
        id: "authToken",
        label: "Auth token",
        secret: true,
        required: false,
        tier: "reports",
        why: "Lets Appable pull crash trends for weekly Reports — Sentry → Settings → Auth Tokens.",
      },
    ],
  },
  branch: {
    id: "branch",
    dashboardUrl: "https://dashboard.branch.io/",
    setupSteps: [
      "Create a Branch account or sign in at branch.io.",
      "Branch dashboard → Account Settings → Profile → your live key.",
      "Add your link domain if you use a custom domain (optional).",
    ],
    fields: [
      {
        id: "liveKey",
        label: "Live key",
        secret: true,
        required: true,
        tier: "app",
        why: "Powers deep links and invite flows in your exported app.",
      },
      {
        id: "domain",
        label: "Link domain (optional)",
        placeholder: "yourapp.app.link",
        tier: "app",
      },
    ],
  },
  appfollow: {
    id: "appfollow",
    dashboardUrl: "https://watch.appfollow.io/",
    setupSteps: [
      "Create an AppFollow account or sign in at appfollow.io.",
      "AppFollow → API → copy your API token.",
    ],
    fields: [
      {
        id: "apiToken",
        label: "API token",
        secret: true,
        required: true,
        tier: "app",
        why: "Also used by Appable Reports for review trends and ASO alerts — stays server-side.",
      },
    ],
  },
  onesignal: {
    id: "onesignal",
    dashboardUrl: "https://dashboard.onesignal.com/",
    setupSteps: [
      "Create a OneSignal account or sign in at onesignal.com.",
      "OneSignal → Settings → Keys & IDs.",
      "App ID is public in the client; REST API key stays server-side.",
    ],
    fields: [
      {
        id: "appId",
        label: "OneSignal App ID",
        required: true,
        tier: "app",
        why: "Public in your app — identifies your OneSignal app.",
      },
      {
        id: "restApiKey",
        label: "REST API key",
        secret: true,
        required: false,
        tier: "reports",
        why: "Appable-only — push stats and weekly Reports. Never shipped in the client app.",
      },
    ],
  },
  appsflyer: {
    id: "appsflyer",
    dashboardUrl: "https://hq1.appsflyer.com/",
    setupSteps: [
      "Create an AppsFlyer account or sign in at appsflyer.com.",
      "AppsFlyer → App settings → Dev key.",
      "Add your iOS App ID / Android package name for store attribution.",
    ],
    fields: [
      {
        id: "devKey",
        label: "Dev key",
        secret: true,
        required: true,
        tier: "app",
        why: "Attribution in your exported app.",
      },
      {
        id: "appId",
        label: "Store app ID / package",
        placeholder: "id123456789 or com.app",
        required: true,
        tier: "app",
      },
    ],
  },
  superwall: {
    id: "superwall",
    dashboardUrl: "https://superwall.com/dashboard",
    setupSteps: [
      "Create a Superwall account or sign in at superwall.com.",
      "Superwall dashboard → your app → Public API key.",
      "Pair with RevenueCat when both are connected.",
    ],
    fields: [
      {
        id: "apiKey",
        label: "Public API key",
        secret: true,
        required: true,
        tier: "app",
        why: "Paywall experiments in your exported app.",
      },
    ],
  },
  admob: {
    id: "admob",
    dashboardUrl: "https://apps.admob.com/",
    setupSteps: [
      "Sign in with your Google account at apps.admob.com (create AdMob if prompted).",
      "AdMob → Apps → your app → App settings.",
      "Use the App ID in app.json; ad unit IDs go in your ad placements.",
    ],
    fields: [
      {
        id: "appId",
        label: "AdMob App ID",
        placeholder: "ca-app-pub-…",
        required: true,
        tier: "app",
        why: "Required in app.json for ads in your export.",
      },
      {
        id: "bannerUnitId",
        label: "Banner ad unit ID (optional)",
        placeholder: "ca-app-pub-…/…",
        tier: "app",
      },
    ],
  },
  stream: {
    id: "stream",
    dashboardUrl: "https://getstream.io/dashboard/",
    setupSteps: [
      "Create a Stream account or sign in at getstream.io.",
      "Stream dashboard → your Chat app → App access keys.",
      "API key + secret are used server-side; app uses a user token flow at runtime.",
    ],
    fields: [
      { id: "apiKey", label: "API key", required: true, tier: "app" },
      {
        id: "apiSecret",
        label: "API secret",
        secret: true,
        required: true,
        tier: "reports",
        why: "Server-side only — Appable uses this for chat health in Reports, not in the client app.",
      },
    ],
  },
  crisp: {
    id: "crisp",
    dashboardUrl: "https://app.crisp.chat/",
    setupSteps: [
      "Create a Crisp account or sign in at crisp.chat.",
      "Crisp → Settings → Website Settings → Website ID.",
    ],
    fields: [
      {
        id: "websiteId",
        label: "Website ID",
        required: true,
        tier: "app",
        why: "Public widget id in your app; support volume may appear in Reports later.",
      },
    ],
  },
  "app-store-connect": {
    id: "app-store-connect",
    dashboardUrl: "https://appstoreconnect.apple.com/access/integrations/api",
    setupSteps: [
      "Sign in to App Store Connect with your Apple Developer account.",
      "App Store Connect → Users and Access → Integrations → App Store Connect API.",
      "Create a key with Developer role; download the .p8 once.",
    ],
    fields: [
      { id: "issuerId", label: "Issuer ID", required: true },
      { id: "keyId", label: "Key ID", required: true },
      { id: "privateKey", label: "Private key (.p8 contents)", secret: true, required: true },
    ],
  },
  "eas-build": {
    id: "eas-build",
    dashboardUrl: "https://expo.dev/accounts/[account]/projects",
    setupSteps: [
      "Create an Expo account or sign in at expo.dev.",
      "Expo dashboard → Access tokens → create a robot or personal token.",
      "Find your EAS project ID under Project settings.",
    ],
    fields: [
      { id: "expoToken", label: "Expo access token", secret: true, required: true },
      { id: "projectId", label: "EAS project ID", required: true },
    ],
  },
  github: {
    id: "github",
    dashboardUrl: "https://github.com/settings/tokens",
    setupSteps: [
      "Create a GitHub account or sign in at github.com.",
      "GitHub → Settings → Developer settings → Personal access tokens.",
      "Scopes: repo (for private repos) or public_repo.",
    ],
    fields: [
      { id: "token", label: "Personal access token", secret: true, required: true },
      { id: "repo", label: "Repository (owner/name)", placeholder: "you/my-app", required: true },
    ],
  },
};

const NATIVE_CONNECTOR_IDS = new Set<ConnectorId>(["supabase", "revenuecat", "railway"]);

export type ConnectorConnectionType = "native" | "sdk" | "planned";

export function getConnectorConnectionType(id: ConnectorId): ConnectorConnectionType {
  if (NATIVE_CONNECTOR_IDS.has(id)) return "native";
  if (SDK_CONNECTOR_SPECS[id]) return "sdk";
  return "planned";
}

export function getSdkSpec(id: ConnectorId): SdkConnectorSpec {
  const spec = SDK_CONNECTOR_SPECS[id];
  if (!spec) throw new Error(`No SDK spec for ${id}`);
  return spec;
}

export function appTierFields(spec: SdkConnectorSpec): SdkFieldSpec[] {
  return spec.fields.filter((f) => f.tier !== "reports");
}

export function reportsTierFields(spec: SdkConnectorSpec): SdkFieldSpec[] {
  return spec.fields.filter((f) => f.tier === "reports");
}

export function sdkReportsReady(
  spec: SdkConnectorSpec,
  values: Record<string, string>
): boolean {
  const reports = reportsTierFields(spec);
  if (!reports.length) return true;
  return reports.every((f) => (values[f.id] ?? "").trim().length >= 2);
}

export function validateSdkValues(
  spec: SdkConnectorSpec,
  values: Record<string, string>
): string | null {
  for (const field of appTierFields(spec)) {
    const v = (values[field.id] ?? "").trim();
    if (field.required && v.length < 2) {
      return `${field.label} is required.`;
    }
  }
  for (const field of reportsTierFields(spec)) {
    const v = (values[field.id] ?? "").trim();
    if (v.length > 0 && v.length < 4 && field.secret) {
      return `${field.label} looks too short.`;
    }
  }
  const hasAny = appTierFields(spec).some((f) => (values[f.id] ?? "").trim().length > 0);
  if (!hasAny) return "Enter at least one app key.";
  return null;
}
