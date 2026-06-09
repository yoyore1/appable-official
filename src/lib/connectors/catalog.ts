/** Integration marketplace catalog — opt-in only; suggestions never auto-connect. */

export type ConnectorCategory =
  | "backend"
  | "analytics"
  | "crash"
  | "deep_linking"
  | "reviews"
  | "push"
  | "attribution"
  | "monetization"
  | "ads"
  | "chat"
  | "support"
  | "auth"
  | "publishing"
  | "version_control";

export type ConnectorId =
  | "supabase"
  | "revenuecat"
  | "railway"
  | "posthog"
  | "sentry"
  | "branch"
  | "appfollow"
  | "onesignal"
  | "appsflyer"
  | "superwall"
  | "admob"
  | "stream"
  | "crisp"
  | "apple-sign-in"
  | "google-sign-in"
  | "app-store-connect"
  | "eas-build"
  | "github";

export interface MarketplaceConnectorBase {
  id: ConnectorId;
  displayName: string;
  category: ConnectorCategory;
  /** Short description for marketplace cards */
  role: string;
  connectionsLabel: string;
  /** Full connect flow available in Appable today */
  connectable: boolean;
  suggestPriority: number;
  /** Used for soft suggestions only — never auto-adds to project */
  featurePatterns: RegExp[];
  dependsOn?: ConnectorId[];
}

export const CONNECTOR_CATEGORY_LABELS: Record<ConnectorCategory, string> = {
  backend: "Backend",
  analytics: "Analytics",
  crash: "Crash reporting",
  deep_linking: "Deep linking",
  reviews: "Review monitoring",
  push: "Push notifications",
  attribution: "Attribution",
  monetization: "Monetization",
  ads: "Ads",
  chat: "In-app chat",
  support: "Customer support",
  auth: "Auth",
  publishing: "Publishing",
  version_control: "Version control",
};

export const MARKETPLACE_CATALOG: MarketplaceConnectorBase[] = [
  {
    id: "supabase",
    displayName: "Supabase",
    category: "backend",
    role: "Accounts, database, profiles, and real-time data.",
    connectionsLabel: "Connect Supabase",
    connectable: true,
    suggestPriority: 1,
    featurePatterns: [
      /\bsupabase\b/i,
      /wire\s+(auth|messaging|database|backend)|connect\s+(supabase|backend|database)/i,
      /database\s+schema|create\s+(the\s+)?tables?|real[\s-]?time\s+data/i,
      /sign[\s-]?up\s+and\s+sign[\s-]?in|supabase\s+auth|cloud\s+sync|save\s+to\s+(the\s+)?cloud/i,
    ],
  },
  {
    id: "revenuecat",
    displayName: "RevenueCat",
    category: "monetization",
    role: "In-app purchases and subscriptions — syncs to Supabase via webhooks.",
    connectionsLabel: "Connect RevenueCat",
    connectable: true,
    suggestPriority: 2,
    dependsOn: ["supabase"],
    featurePatterns: [
      /pay|payment|subscribe|subscription|premium|pro\b|in-app purchase/i,
      /revenuecat|paywall/i,
    ],
  },
  {
    id: "superwall",
    displayName: "Superwall",
    category: "monetization",
    role: "Remote paywall experiments — pairs with RevenueCat.",
    connectionsLabel: "Connect Superwall",
    connectable: true,
    suggestPriority: 3,
    dependsOn: ["revenuecat"],
    featurePatterns: [/superwall|paywall experiment|a\/b paywall/i],
  },
  {
    id: "railway",
    displayName: "Railway",
    category: "backend",
    role: "Custom API, workers, and cron when Supabase is not enough.",
    connectionsLabel: "Connect Railway",
    connectable: true,
    suggestPriority: 4,
    featurePatterns: [
      /\brailway\b/i,
      /custom (api|server|backend)/i,
      /background worker|cron job/i,
    ],
  },
  {
    id: "posthog",
    displayName: "PostHog",
    category: "analytics",
    role: "Product analytics, funnels, and session replay.",
    connectionsLabel: "Add PostHog",
    connectable: true,
    suggestPriority: 10,
    featurePatterns: [/posthog|product analytics|funnel|event tracking/i],
  },
  {
    id: "sentry",
    displayName: "Sentry",
    category: "crash",
    role: "Crash reporting and performance monitoring.",
    connectionsLabel: "Connect Sentry",
    connectable: true,
    suggestPriority: 11,
    featurePatterns: [/sentry|crash report|error monitoring/i],
  },
  {
    id: "branch",
    displayName: "Branch.io",
    category: "deep_linking",
    role: "Deep links, deferred deep links, and attribution links.",
    connectionsLabel: "Connect Branch",
    connectable: true,
    suggestPriority: 12,
    featurePatterns: [/branch\.?io|deep link|deferred link|app link/i],
  },
  {
    id: "appfollow",
    displayName: "AppFollow",
    category: "reviews",
    role: "App Store review monitoring and ASO insights.",
    connectionsLabel: "Connect AppFollow",
    connectable: true,
    suggestPriority: 13,
    featurePatterns: [/appfollow|review monitor|aso|app store review/i],
  },
  {
    id: "onesignal",
    displayName: "OneSignal",
    category: "push",
    role: "Push notifications and in-app messaging campaigns.",
    connectionsLabel: "Connect OneSignal",
    connectable: true,
    suggestPriority: 14,
    dependsOn: ["supabase"],
    featurePatterns: [/onesignal|push notification|push alert/i],
  },
  {
    id: "appsflyer",
    displayName: "AppsFlyer",
    category: "attribution",
    role: "Mobile attribution and campaign measurement.",
    connectionsLabel: "Connect AppsFlyer",
    connectable: true,
    suggestPriority: 15,
    featurePatterns: [/appsflyer|attribution|install campaign|mmp/i],
  },
  {
    id: "admob",
    displayName: "AdMob",
    category: "ads",
    role: "In-app ads and rewarded video.",
    connectionsLabel: "Connect AdMob",
    connectable: true,
    suggestPriority: 16,
    featurePatterns: [/admob|in-app ad|banner ad|rewarded ad/i],
  },
  {
    id: "stream",
    displayName: "Stream",
    category: "chat",
    role: "Production-grade in-app chat SDK.",
    connectionsLabel: "Connect Stream",
    connectable: true,
    suggestPriority: 17,
    featurePatterns: [/getstream|stream chat|in-app chat sdk/i],
  },
  {
    id: "crisp",
    displayName: "Crisp",
    category: "support",
    role: "In-app customer support chat widget.",
    connectionsLabel: "Connect Crisp",
    connectable: true,
    suggestPriority: 18,
    featurePatterns: [/crisp|customer support chat|help widget/i],
  },
  {
    id: "apple-sign-in",
    displayName: "Apple Sign In",
    category: "auth",
    role: "Sign in with Apple — configured via Supabase Auth or native.",
    connectionsLabel: "Add Apple Sign In",
    connectable: false,
    suggestPriority: 19,
    dependsOn: ["supabase"],
    featurePatterns: [/apple sign.?in|sign in with apple|apple login/i],
  },
  {
    id: "google-sign-in",
    displayName: "Google Sign In",
    category: "auth",
    role: "Google OAuth — configured via Supabase Auth or native.",
    connectionsLabel: "Add Google Sign In",
    connectable: false,
    suggestPriority: 20,
    dependsOn: ["supabase"],
    featurePatterns: [/google sign.?in|sign in with google|google login|google oauth/i],
  },
  {
    id: "app-store-connect",
    displayName: "App Store Connect API",
    category: "publishing",
    role: "Automate TestFlight and App Store submissions.",
    connectionsLabel: "Connect App Store Connect",
    connectable: true,
    suggestPriority: 21,
    featurePatterns: [/app store connect|testflight|asc api|app store submission/i],
  },
  {
    id: "eas-build",
    displayName: "EAS Build",
    category: "publishing",
    role: "Expo Application Services — cloud iOS and Android builds.",
    connectionsLabel: "Connect EAS Build",
    connectable: true,
    suggestPriority: 22,
    featurePatterns: [/\beas build\b|expo application services|expo build/i],
  },
  {
    id: "github",
    displayName: "GitHub",
    category: "version_control",
    role: "Connect your repo for export, CI, and builder handoff.",
    connectionsLabel: "Connect GitHub",
    connectable: true,
    suggestPriority: 23,
    featurePatterns: [/github|git repo|version control|source code repo/i],
  },
];

export function getCatalogEntry(id: ConnectorId): MarketplaceConnectorBase {
  const hit = MARKETPLACE_CATALOG.find((c) => c.id === id);
  if (!hit) throw new Error(`Unknown connector: ${id}`);
  return hit;
}

export function catalogSorted(): MarketplaceConnectorBase[] {
  return [...MARKETPLACE_CATALOG].sort((a, b) => a.suggestPriority - b.suggestPriority);
}
