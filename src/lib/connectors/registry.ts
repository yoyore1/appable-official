import type {
  InterviewTurn,
  MasterBuildPrompt,
  RailwayConnectorPublic,
  RevenueCatConnectorPublic,
  SupabaseConnectorPublic,
} from "@/lib/types";
import type { AppReadinessAudit, ReadinessItem } from "@/lib/expoApp/readinessAudit";

/** Add new connectors here — coach, checklist, and Build routing pick them up automatically. */
export type ConnectorId = "supabase" | "revenuecat" | "railway";

export interface ProjectConnectorState {
  supabase: SupabaseConnectorPublic | null;
  revenueCat: RevenueCatConnectorPublic | null;
  railway: RailwayConnectorPublic | null;
}

export interface ConnectorDefinition {
  id: ConnectorId;
  displayName: string;
  /** Short label in Connections panel */
  connectionsLabel: string;
  /** What this connector is for (coach) */
  role: string;
  /** Checklist rows it helps with */
  checklistIds: string[];
  /** Suggest when audit has these rows and they're not done */
  triggerChecklistIds: string[];
  /** Master prompt / interview signals */
  featurePatterns: RegExp[];
  /** Must connect these first */
  dependsOn?: ConnectorId[];
  /** Lower = suggest earlier */
  suggestPriority: number;
  whenMissing: string;
  whenConnected: (state: ProjectConnectorState) => string;
  patchAuditItem?: (
    item: ReadinessItem,
    state: ProjectConnectorState
  ) => ReadinessItem | null;
}

const REGISTRY: ConnectorDefinition[] = [
  {
    id: "supabase",
    displayName: "Supabase",
    connectionsLabel: "Connect Supabase",
    role: "Accounts, database, profiles, real-time data — foundation for auth and most backends.",
    checklistIds: [
      "backend",
      "auth",
      "account-controls",
      "google-sign-in",
      "apple-sign-in",
      "onboarding",
      "messaging",
      "roles",
    ],
    triggerChecklistIds: ["backend", "auth", "messaging", "roles", "onboarding"],
    featurePatterns: [
      /sign[\s-]?in|sign[\s-]?up|log[\s-]?in|register|account|auth|password/i,
      /database|backend|supabase|firebase|server|cloud sync|save.*device/i,
      /profile|user data|owner|walker|role|two.?sided|marketplace/i,
      /message|chat|inbox|notification/i,
      /onboarding.*account|create a user/i,
    ],
    suggestPriority: 1,
    whenMissing:
      "Connect **Supabase** in Connections (not Build) — needed for sign-in, saving user data, and chat. Email test works in preview after connect + Build wire sign-up.",
    whenConnected: (s) => {
      const pub = s.supabase!;
      if (pub.status === "setup_failed") {
        return `Supabase linked to "${pub.projectName}" but table setup failed — retry in Connections.`;
      }
      return (
        `Supabase connected ("${pub.projectName}"). Auth + appable_profiles ready. ` +
        `Build wires sign-up in preview; Google/Apple setup is under Connections.`
      );
    },
    patchAuditItem: (item, state) => {
      const pub = state.supabase;
      if (!pub || pub.status === "disconnected") return null;

      if (item.id === "backend") {
        return {
          ...item,
          status: "partial",
          plainWhy:
            pub.status === "connected"
              ? `Supabase "${pub.projectName}" is linked — data & auth live here.`
              : `Supabase linked but setup failed — retry in Connections.`,
          inPreview: false,
        };
      }

      if (item.id === "auth" && pub.status === "connected" && pub.schemaVersion >= 1) {
        return {
          ...item,
          status: "partial",
          plainWhy:
            "Supabase auth is ready. Preview has Google, Apple, and email — enable OAuth in Connections before launch.",
          inPreview: item.inPreview,
        };
      }

      return null;
    },
  },
  {
    id: "revenuecat",
    displayName: "RevenueCat",
    connectionsLabel: "Connect RevenueCat",
    role: "In-app purchases, subscriptions, paywalls — syncs entitlement state to Supabase via webhooks.",
    checklistIds: ["payments"],
    triggerChecklistIds: ["payments"],
    featurePatterns: [
      /pay|payment|subscribe|subscription|premium|pro\b|in-app purchase/i,
      /revenue|monetiz|sell|fee|commission|marketplace/i,
      /revenuecat|stripe.*app|paywall/i,
    ],
    dependsOn: ["supabase"],
    suggestPriority: 2,
    whenMissing:
      "This app looks like it needs paid features — connect **RevenueCat** in Connections **after Supabase** (webhooks write to Supabase). Skip if the app is 100% free.",
    whenConnected: (s) => {
      const rc = s.revenueCat!;
      return rc.webhooksConfigured
        ? "RevenueCat connected — webhooks live, subscription state syncs to Supabase."
        : "RevenueCat connected — paste the webhook URL shown in Connections so Supabase stays in sync.";
    },
    patchAuditItem: (item, state) => {
      if (item.id !== "payments" || !state.revenueCat || state.revenueCat.status !== "connected") {
        return null;
      }
      const rc = state.revenueCat;
      return {
        ...item,
        status: "partial",
        plainWhy: rc.webhooksConfigured
          ? "RevenueCat linked — subscriptions sync to appable_subscriptions in Supabase."
          : "RevenueCat linked — add the webhook in RevenueCat (copy from Connections).",
        inPreview: item.inPreview,
      };
    },
  },
  {
    id: "railway",
    displayName: "Railway",
    connectionsLabel: "Connect Railway",
    role: "Custom API, background workers, cron jobs — when Supabase alone isn't enough for server logic.",
    checklistIds: ["backend"],
    triggerChecklistIds: [],
    featurePatterns: [
      /\brailway\b/i,
      /custom (api|server|backend)/i,
      /own (api|server|backend)/i,
      /deploy (a |an |my |our )?(api|server|backend|node|express|fastapi)/i,
      /(cron|scheduled) job/i,
      /background worker/i,
      /server.?side (ai|llm|processing|scraping)/i,
      /webhook (handler|endpoint|server)/i,
      /express\.?js|fastapi|flask app|django app/i,
      /host (my|a|our) (api|backend|server)/i,
    ],
    suggestPriority: 3,
    whenMissing:
      "This app looks like it needs a **custom server** — connect **Railway** in Connections only if you're deploying your own API or workers. Skip if Supabase covers everything.",
    whenConnected: (s) => {
      const rw = s.railway!;
      return `Railway connected — API at ${rw.serviceUrl}. Ask Build to wire calls to this URL when ready.`;
    },
    patchAuditItem: (item, state) => {
      if (item.id !== "backend" || !state.railway || state.railway.status !== "connected") {
        return null;
      }
      return {
        ...item,
        status: state.supabase?.status === "connected" ? "partial" : item.status,
        plainWhy: `Custom API on Railway (${state.railway.serviceUrl})${state.supabase?.status === "connected" ? " — Supabase still handles auth/data." : "."}`,
        inPreview: item.inPreview,
      };
    },
  },
];

export function getConnectorDefinition(id: ConnectorId): ConnectorDefinition {
  const def = REGISTRY.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown connector: ${id}`);
  return def;
}

export function allConnectorDefinitions(): ConnectorDefinition[] {
  return [...REGISTRY].sort((a, b) => a.suggestPriority - b.suggestPriority);
}

export function isConnectorConnected(
  id: ConnectorId,
  state: ProjectConnectorState
): boolean {
  if (id === "supabase") {
    const s = state.supabase;
    return Boolean(s && s.status !== "disconnected");
  }
  if (id === "revenuecat") {
    return state.revenueCat?.status === "connected";
  }
  if (id === "railway") {
    return state.railway?.status === "connected";
  }
  return false;
}

function blobFrom(mp: MasterBuildPrompt, interview: InterviewTurn[]): string {
  const parts = [
    mp.description,
    mp.audience,
    mp.twist ?? "",
    ...mp.features,
    ...interview.map((t) => `${t.question} ${t.answer}`),
  ];
  return parts.join(" ").toLowerCase();
}

/** Which connectors this app actually needs — from checklist + interview signals. */
export function inferConnectorNeeds(input: {
  mp: MasterBuildPrompt;
  interview: InterviewTurn[];
  audit: AppReadinessAudit | null;
}): ConnectorId[] {
  const needed = new Set<ConnectorId>();
  const text = blobFrom(input.mp, input.interview);
  const audit = input.audit;

  for (const def of REGISTRY) {
    const checklistHit = def.triggerChecklistIds.some((id) =>
      audit?.items.some(
        (i) => i.id === id && i.priority !== "nice_to_have" && i.status !== "have"
      )
    );
    const featureHit = def.featurePatterns.some((re) => re.test(text));
    if (checklistHit || featureHit) needed.add(def.id);
  }

  // Supabase is implied whenever auth or backend checklist rows exist
  if (audit?.items.some((i) => /^(auth|backend|roles)$/.test(i.id))) {
    needed.add("supabase");
  }

  return allConnectorDefinitions()
    .map((d) => d.id)
    .filter((id) => needed.has(id));
}

export interface ConnectorRecommendation {
  id: ConnectorId;
  displayName: string;
  reason: string;
  connectLabel: string;
  blockedBy?: ConnectorId;
}

/** Next connector the founder should hook up (for UI + coach). */
export function getConnectorRecommendations(
  state: ProjectConnectorState,
  needs: ConnectorId[]
): ConnectorRecommendation[] {
  const out: ConnectorRecommendation[] = [];

  for (const id of needs) {
    if (isConnectorConnected(id, state)) continue;
    const def = getConnectorDefinition(id);
    const blocked = def.dependsOn?.find((dep) => !isConnectorConnected(dep, state));
    const reason = blocked
      ? `Needs ${getConnectorDefinition(blocked).displayName} first — ${def.role}`
      : def.role;
    out.push({
      id,
      displayName: def.displayName,
      reason,
      connectLabel: def.connectionsLabel,
      blockedBy: blocked,
    });
  }

  return out.sort(
    (a, b) =>
      getConnectorDefinition(a.id).suggestPriority -
      getConnectorDefinition(b.id).suggestPriority
  );
}

/** User explicitly asked about a connector — suggest even if app signals didn't infer it. */
export function connectorsRequestedInMessage(message: string): ConnectorId[] {
  const m = message.toLowerCase();
  const hits: ConnectorId[] = [];

  if (/supabase|sign[\s-]?in|sign[\s-]?up|auth|account|google login|apple login/.test(m)) {
    hits.push("supabase");
  }
  if (/revenuecat|subscription|paywall|in-app purchase|premium tier/.test(m)) {
    hits.push("revenuecat");
  }
  if (
    /\brailway\b|custom (api|server)|deploy (api|server)|background worker|cron job/.test(m)
  ) {
    hits.push("railway");
  }

  return hits;
}

/** Merge inferred app needs with explicit user requests (chat). */
export function mergeConnectorNeeds(
  inferred: ConnectorId[],
  message?: string
): ConnectorId[] {
  const requested = message ? connectorsRequestedInMessage(message) : [];
  const set = new Set<ConnectorId>([...inferred, ...requested]);
  return allConnectorDefinitions()
    .map((d) => d.id)
    .filter((id) => set.has(id));
}

/** Match user message to connector topics for retrieval focus. */
export function connectorsForMessage(
  message: string,
  needs: ConnectorId[]
): ConnectorId[] {
  const m = message.toLowerCase();
  const hits = new Set<ConnectorId>(connectorsRequestedInMessage(message));

  for (const id of needs) {
    const def = getConnectorDefinition(id);
    if (id === "supabase" && /sign|auth|account|database|backend|supabase|profile|google|apple|email/.test(m)) {
      hits.add(id);
    } else if (
      id === "revenuecat" &&
      /pay|subscription|premium|purchase|revenue|monetiz|revenuecat|paywall/.test(m)
    ) {
      hits.add(id);
    } else if (id === "railway" && def.featurePatterns.some((re) => re.test(m))) {
      hits.add(id);
    } else if (def.featurePatterns.some((re) => re.test(m))) {
      hits.add(id);
    }
  }

  return [...hits];
}

/** Kimi / Build system context — single source for connector routing rules. */
export function formatConnectorContextForCoach(
  state: ProjectConnectorState,
  needs: ConnectorId[],
  audit?: AppReadinessAudit | null
): string {
  const lines: string[] = ["CONNECTOR ROUTING (follow strictly):"];

  if (needs.length === 0) {
    lines.push(
      "- This app may not need paid backends yet — preview UI tweaks go to **Build**.",
      "- If they add accounts or payments later, suggest **Supabase** then **RevenueCat** in Connections."
    );
  } else {
    lines.push(
      `- This app NEEDS: ${needs.map((id) => getConnectorDefinition(id).displayName).join(" → ")} (in that order when multiple).`
    );
  }

  for (const def of allConnectorDefinitions()) {
    const required = needs.includes(def.id);
    const connected = isConnectorConnected(def.id, state);
    if (!required && !connected) continue;

    const status = connected ? "CONNECTED" : "NOT CONNECTED";
    lines.push(`- ${def.displayName} [${status}]: ${def.role}`);
    lines.push(`  ${connected ? def.whenConnected(state) : def.whenMissing}`);
  }

  const recs = getConnectorRecommendations(state, needs);
  if (recs.length > 0) {
    const next = recs[0];
    lines.push(
      `- Suggest next: **${next.displayName}** — ${next.reason}${next.blockedBy ? ` (after ${getConnectorDefinition(next.blockedBy).displayName})` : ""}.`
    );
  }

    lines.push(
      "- Sign-in / accounts → **Connections: Supabase**, then **Build** to wire preview. Google/Apple guides are in Connections.",
      "- Subscriptions / paywall → **RevenueCat** only if app charges money; requires Supabase first.",
      "- Custom API / workers / cron → **Railway** only when the app truly needs its own server — not for basic auth or lists.",
      "- Never tell users to paste API keys in chat. Never send database work to Build without Supabase connected."
    );

  if (audit) {
    const gaps = audit.launchBlockers
      .filter((i) => i.status !== "have")
      .slice(0, 4)
      .map((i) => i.id);
    if (gaps.length) {
      lines.push(`- Launch blockers tied to connectors: ${gaps.join(", ")}`);
    }
  }

  return lines.join("\n");
}

export function applyConnectorRegistryToAudit(
  audit: AppReadinessAudit,
  state: ProjectConnectorState
): AppReadinessAudit {
  let items = audit.items;

  for (const def of REGISTRY) {
    if (!isConnectorConnected(def.id, state)) continue;
    items = items.map((item) => {
      if (!def.checklistIds.includes(item.id)) return item;
      const patched = def.patchAuditItem?.(item, state);
      return patched ?? item;
    });
  }

  return { ...audit, items };
}

export function projectConnectorState(project: {
  supabaseConnector?: { public: SupabaseConnectorPublic } | null;
  revenueCatConnector?: { public: RevenueCatConnectorPublic } | null;
  railwayConnector?: { public: RailwayConnectorPublic } | null;
}): ProjectConnectorState {
  return {
    supabase: project.supabaseConnector?.public ?? null,
    revenueCat: project.revenueCatConnector?.public ?? null,
    railway: project.railwayConnector?.public ?? null,
  };
}

/** Build agent: block or route backend work to the right connector. */
export function buildConnectorRouting(
  message: string,
  state: ProjectConnectorState,
  needs: ConnectorId[]
): {
  supabaseWire: boolean;
  connectorReply: string | null;
} {
  const m = message.toLowerCase();

  const wantsAuth =
    /supabase|auth|sign[\s-]?up|sign[\s-]?in|account|register|backend|database|wire/.test(m);
  const wantsPayments = /revenuecat|subscription|paywall|in-app purchase|payment/.test(m);

  if (wantsAuth || /wire/.test(m) && /sign|auth|account/.test(m)) {
    if (!isConnectorConnected("supabase", state)) {
      const rec = getConnectorRecommendations(state, needs).find((r) => r.id === "supabase");
      return {
        supabaseWire: false,
        connectorReply:
          rec?.reason ??
          "Link **Supabase** in Connections first, then ask Build to wire sign-up in the preview.",
      };
    }
    return { supabaseWire: true, connectorReply: null };
  }

  const wantsRailway =
    /railway|custom (api|server)|deploy.*(api|server)|background worker|cron/.test(m);

  if (wantsRailway && needs.includes("railway")) {
    if (!isConnectorConnected("railway", state)) {
      return {
        supabaseWire: false,
        connectorReply:
          "For a custom API or worker, connect **Railway** in Connections — only needed when Supabase isn't enough for your server logic.",
      };
    }
  }

  if (wantsPayments && needs.includes("revenuecat")) {
    if (!isConnectorConnected("supabase", state)) {
      return {
        supabaseWire: false,
        connectorReply:
          "Connect **Supabase** first — RevenueCat webhooks sync subscription data there.",
      };
    }
    if (!isConnectorConnected("revenuecat", state)) {
      return {
        supabaseWire: false,
        connectorReply:
          "For subscriptions, connect **RevenueCat** in Connections (after Supabase). Preview paywall UI can still be tweaked in Build.",
      };
    }
  }

  return { supabaseWire: false, connectorReply: null };
}
