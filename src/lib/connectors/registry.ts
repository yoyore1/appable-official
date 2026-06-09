import type {
  InterviewTurn,
  MasterBuildPrompt,
  RailwayConnectorPublic,
  RevenueCatConnectorPublic,
  SupabaseConnectorPublic,
} from "@/lib/types";
import type { AppReadinessAudit, ReadinessItem } from "@/lib/expoApp/readinessAudit";
import type { SdkConnectorPublic } from "@/lib/types";
import {
  catalogSorted,
  getCatalogEntry,
  MARKETPLACE_CATALOG,
  type ConnectorCategory,
  type ConnectorId,
  type MarketplaceConnectorBase,
} from "./catalog";
import { formatIntegrationPlaybooks } from "./integrationPrompts";
import { founderVoiceBlock } from "@/lib/expoApp/founderVoice";
import { integrationCredentialGuide } from "./credentialTiers";
import { getConnectorConnectionType } from "./sdkCatalog";
import { sdkConnectorPublic } from "./sdkConnector";

export type { ConnectorCategory, ConnectorId } from "./catalog";

export interface ProjectConnectorState {
  supabase: SupabaseConnectorPublic | null;
  revenueCat: RevenueCatConnectorPublic | null;
  railway: RailwayConnectorPublic | null;
  sdk: Partial<Record<ConnectorId, SdkConnectorPublic | null>>;
}

export interface ConnectorDefinition extends MarketplaceConnectorBase {
  checklistIds: string[];
  triggerChecklistIds: string[];
  whenMissing: string;
  whenConnected: (state: ProjectConnectorState) => string;
  patchAuditItem?: (
    item: ReadinessItem,
    state: ProjectConnectorState
  ) => ReadinessItem | null;
}

const CONNECTABLE_EXTRAS: Partial<
  Record<
    ConnectorId,
    Pick<
      ConnectorDefinition,
      "checklistIds" | "triggerChecklistIds" | "whenMissing" | "whenConnected" | "patchAuditItem"
    >
  >
> = {
  supabase: {
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
    whenMissing:
      "Optional — connect **Supabase** in Integrations when you want real accounts, database, and chat.",
    whenConnected: (s) => {
      const pub = s.supabase!;
      if (pub.status === "setup_failed") {
        return `Supabase linked to "${pub.projectName}" but table setup failed — retry in Integrations.`;
      }
      return (
        `Supabase connected ("${pub.projectName}"). Auth + profiles ready. ` +
        `Google/Apple setup is under Integrations when you need OAuth.`
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
              ? `Supabase "${pub.projectName}" is linked.`
              : `Supabase linked but setup failed — retry in Integrations.`,
          inPreview: false,
        };
      }
      if (item.id === "auth" && pub.status === "connected" && pub.schemaVersion >= 1) {
        return {
          ...item,
          status: "partial",
          plainWhy:
            "Supabase auth is ready. Enable Google/Apple in Integrations before launch if you need them.",
          inPreview: item.inPreview,
        };
      }
      return null;
    },
  },
  revenuecat: {
    checklistIds: ["payments"],
    triggerChecklistIds: ["payments"],
    whenMissing:
      "Optional — connect **RevenueCat** when you charge money. Requires Supabase first for webhook sync.",
    whenConnected: (s) => {
      const rc = s.revenueCat!;
      return rc.webhooksConfigured
        ? "RevenueCat connected — subscription state syncs to Supabase."
        : "RevenueCat connected — paste the webhook URL from Integrations into RevenueCat.";
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
          ? "RevenueCat linked — subscriptions sync to Supabase."
          : "RevenueCat linked — add the webhook in RevenueCat dashboard.",
        inPreview: item.inPreview,
      };
    },
  },
  railway: {
    checklistIds: ["backend"],
    triggerChecklistIds: [],
    whenMissing:
      "Optional — connect **Railway** only if you need a custom API or background workers.",
    whenConnected: (s) => `Railway connected — API at ${s.railway!.serviceUrl}.`,
    patchAuditItem: (item, state) => {
      if (item.id !== "backend" || !state.railway || state.railway.status !== "connected") {
        return null;
      }
      return {
        ...item,
        status: state.supabase?.status === "connected" ? "partial" : item.status,
        plainWhy: `Custom API on Railway (${state.railway.serviceUrl}).`,
        inPreview: item.inPreview,
      };
    },
  },
};

function buildDefinition(base: MarketplaceConnectorBase): ConnectorDefinition {
  const extra = CONNECTABLE_EXTRAS[base.id];
  return {
    ...base,
    checklistIds: extra?.checklistIds ?? [],
    triggerChecklistIds: extra?.triggerChecklistIds ?? [],
    whenMissing:
      extra?.whenMissing ??
      `Added to your project — connect **${base.displayName}** when the setup flow is available.`,
    whenConnected:
      extra?.whenConnected ??
      (() => `${base.displayName} is on your integration plan.`),
    patchAuditItem: extra?.patchAuditItem,
  };
}

const REGISTRY: ConnectorDefinition[] = MARKETPLACE_CATALOG.map(buildDefinition);

export function getConnectorDefinition(id: ConnectorId): ConnectorDefinition {
  return buildDefinition(getCatalogEntry(id));
}

export function allConnectorDefinitions(): ConnectorDefinition[] {
  return REGISTRY;
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
  if (getConnectorConnectionType(id) === "sdk") {
    return state.sdk[id]?.status === "connected";
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

/**
 * Soft suggestions from app type + interview — never auto-adds to project.
 * @deprecated Use suggestConnectors — same behavior, clearer name.
 */
export function inferConnectorNeeds(input: {
  mp: MasterBuildPrompt;
  interview: InterviewTurn[];
  audit: AppReadinessAudit | null;
}): ConnectorId[] {
  return suggestConnectors(input);
}

/** Soft suggestions — marketplace opt-in only; does not modify the project. */
export function suggestConnectors(input: {
  mp: MasterBuildPrompt;
  interview: InterviewTurn[];
  audit: AppReadinessAudit | null;
}): ConnectorId[] {
  const suggested = new Set<ConnectorId>();
  const text = blobFrom(input.mp, input.interview);
  const audit = input.audit;

  for (const def of REGISTRY) {
    const checklistHit = def.triggerChecklistIds.some((id) =>
      audit?.items.some(
        (i) => i.id === id && i.priority !== "nice_to_have" && i.status !== "have"
      )
    );
    const featureHit = def.featurePatterns.some((re) => re.test(text));
    if (checklistHit || featureHit) suggested.add(def.id);
  }

  return catalogSorted()
    .map((d) => d.id)
    .filter((id) => suggested.has(id));
}

export interface ConnectorRecommendation {
  id: ConnectorId;
  displayName: string;
  reason: string;
  connectLabel: string;
  blockedBy?: ConnectorId;
}

/** Suggested integrations the founder might want — optional, never required. */
export function getConnectorRecommendations(
  state: ProjectConnectorState,
  suggestions: ConnectorId[]
): ConnectorRecommendation[] {
  const out: ConnectorRecommendation[] = [];

  for (const id of suggestions) {
    if (isConnectorConnected(id, state)) continue;
    const def = getConnectorDefinition(id);
    const blocked = def.dependsOn?.find((dep) => !isConnectorConnected(dep, state));
    const reason = blocked
      ? `Often used after ${getConnectorDefinition(blocked).displayName} — ${def.role}`
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

/** Integrations shown in the Connections panel — connected or explicitly added from marketplace. */
export function visibleConnectorIds(
  state: ProjectConnectorState,
  selections: ConnectorId[]
): ConnectorId[] {
  const ids = new Set<ConnectorId>();
  for (const def of REGISTRY) {
    if (isConnectorConnected(def.id, state)) ids.add(def.id);
  }
  for (const id of selections) ids.add(id);
  return catalogSorted()
    .map((d) => d.id)
    .filter((id) => ids.has(id));
}

export function connectorsRequestedInMessage(message: string): ConnectorId[] {
  const m = message.toLowerCase();
  const hits = new Set<ConnectorId>();

  for (const def of REGISTRY) {
    const slug = def.id.replace(/-/g, "[\\s-]?");
    if (new RegExp(`\\b${slug}\\b`, "i").test(m)) hits.add(def.id);
    if (def.featurePatterns.some((re) => re.test(m))) hits.add(def.id);
  }

  return catalogSorted()
    .map((d) => d.id)
    .filter((id) => hits.has(id));
}

/** Chat retrieval focus — explicit mentions + soft suggestions. */
export function mergeConnectorNeeds(
  inferred: ConnectorId[],
  message?: string
): ConnectorId[] {
  const requested = message ? connectorsRequestedInMessage(message) : [];
  const set = new Set<ConnectorId>([...inferred, ...requested]);
  return catalogSorted()
    .map((d) => d.id)
    .filter((id) => set.has(id));
}

export function connectorsForMessage(
  message: string,
  suggestions: ConnectorId[]
): ConnectorId[] {
  const hits = new Set<ConnectorId>(connectorsRequestedInMessage(message));
  for (const id of suggestions) {
    const def = getConnectorDefinition(id);
    if (def.featurePatterns.some((re) => re.test(message.toLowerCase()))) {
      hits.add(id);
    }
  }
  return [...hits];
}

export function formatConnectorContextForCoach(
  state: ProjectConnectorState,
  suggestions: ConnectorId[],
  audit?: AppReadinessAudit | null,
  selections: ConnectorId[] = [],
  appName = "this app"
): string {
  const lines: string[] = [
    founderVoiceBlock(appName),
    "INTEGRATION MARKETPLACE (opt-in only — follow strictly):",
    "- Never auto-connect or auto-install SDKs. Founders browse the marketplace and add what they want.",
    "- Only wire codegen/config for integrations they **connected** or **added** from the marketplace.",
  ];

  const connected = catalogSorted()
    .filter((d) => isConnectorConnected(d.id, state))
    .map((d) => d.displayName);
  const added = selections
    .filter((id) => !isConnectorConnected(id, state))
    .map((id) => getConnectorDefinition(id).displayName);

  if (connected.length) {
    lines.push(`- Connected: ${connected.join(", ")}`);
  } else {
    lines.push("- Connected: none yet");
  }
  if (added.length) {
    lines.push(`- Added to plan (not connected yet): ${added.join(", ")}`);
  }

  const recs = getConnectorRecommendations(state, suggestions).slice(0, 3);
  if (recs.length) {
    lines.push(
      `- Optional suggestions (mention only if relevant — do not treat as requirements): ${recs.map((r) => r.displayName).join(", ")}`
    );
  }

  for (const def of REGISTRY) {
    const onProject =
      isConnectorConnected(def.id, state) || selections.includes(def.id);
    if (!onProject) continue;
    const connected = isConnectorConnected(def.id, state);
    let detail = connected ? def.whenConnected(state) : def.whenMissing;
    if (connected && getConnectorConnectionType(def.id) === "sdk") {
      const hints = state.sdk[def.id]?.hints;
      if (hints && Object.keys(hints).length) {
        detail += ` Keys on file: ${Object.keys(hints).join(", ")}.`;
      }
    }
    lines.push(
      `- ${def.displayName} [${connected ? "CONNECTED" : "ADDED"}]: ${detail}`
    );
  }

  lines.push(
    "- Preview UI tweaks → **Build**. Backend keys → **Integrations marketplace**.",
    "- Never tell users to paste API keys in chat.",
    "- **Credential tiers:** App keys ship in export; Reports keys stay in Appable for weekly insights.",
    ...catalogSorted()
      .filter((d) => isConnectorConnected(d.id, state) || selections.includes(d.id))
      .slice(0, 6)
      .map((d) => integrationCredentialGuide(d.id))
  );

  const playbookIds = [
    ...new Set([
      ...selections,
      ...catalogSorted()
        .filter((d) => isConnectorConnected(d.id, state))
        .map((d) => d.id),
      ...suggestions.slice(0, 5),
    ]),
  ];
  const playbooks = formatIntegrationPlaybooks(playbookIds, appName);
  if (playbooks) lines.push(playbooks);

  if (audit) {
    const gaps = audit.launchBlockers
      .filter((i) => i.status !== "have")
      .slice(0, 4)
      .map((i) => i.id);
    if (gaps.length) {
      lines.push(`- Launch checklist gaps (discuss, do not auto-fix with connectors): ${gaps.join(", ")}`);
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
  sdkConnectors?: Partial<
    Record<ConnectorId, { public: SdkConnectorPublic }>
  > | null;
}): ProjectConnectorState {
  const sdk: ProjectConnectorState["sdk"] = {};
  for (const [id, conn] of Object.entries(project.sdkConnectors ?? {})) {
    sdk[id as ConnectorId] = sdkConnectorPublic(conn ?? null);
  }
  return {
    supabase: project.supabaseConnector?.public ?? null,
    revenueCat: project.revenueCatConnector?.public ?? null,
    railway: project.railwayConnector?.public ?? null,
    sdk,
  };
}

function userInitiatedConnectorWork(
  id: ConnectorId,
  message: string,
  selections: ConnectorId[]
): boolean {
  if (selections.includes(id)) return true;
  return connectorsRequestedInMessage(message).includes(id);
}

/** Build agent: route only when the user asks to wire something that needs a connector. */
export function buildConnectorRouting(
  message: string,
  state: ProjectConnectorState,
  suggestions: ConnectorId[],
  selections: ConnectorId[] = []
): {
  supabaseWire: boolean;
  connectorReply: string | null;
} {
  const m = message.toLowerCase();

  const wantsMessagingSchema =
    /messag|chat|inbox|conversation|sender_id|thread/.test(m) &&
    /table|schema|wire|add|create|database|supabase|build/.test(m);
  const wantsAuth =
    !wantsMessagingSchema &&
    /supabase|auth|sign[\s-]?up|sign[\s-]?in|account|register|wire/.test(m);
  const wantsPayments = /revenuecat|subscription|paywall|in-app purchase|payment/.test(m);
  const wantsRailway =
    /railway|custom (api|server)|deploy.*(api|server)|background worker|cron/.test(m);

  if (wantsMessagingSchema) {
    return { supabaseWire: false, connectorReply: null };
  }

  if (wantsAuth || (/wire/.test(m) && /sign|auth|account/.test(m))) {
    if (!isConnectorConnected("supabase", state)) {
      return {
        supabaseWire: false,
        connectorReply:
          "To wire real auth, add **Supabase** from the **Integrations marketplace**, connect it, then ask Build again.",
      };
    }
    return { supabaseWire: true, connectorReply: null };
  }

  if (
    wantsRailway &&
    (userInitiatedConnectorWork("railway", message, selections) ||
      suggestions.includes("railway"))
  ) {
    if (!isConnectorConnected("railway", state)) {
      return {
        supabaseWire: false,
        connectorReply:
          "Add **Railway** from the Integrations marketplace and connect it when you need a custom API.",
      };
    }
  }

  if (
    wantsPayments &&
    (userInitiatedConnectorWork("revenuecat", message, selections) ||
      suggestions.includes("revenuecat"))
  ) {
    if (!isConnectorConnected("supabase", state)) {
      return {
        supabaseWire: false,
        connectorReply:
          "For subscriptions, connect **Supabase** first, then add **RevenueCat** from the marketplace.",
      };
    }
    if (!isConnectorConnected("revenuecat", state)) {
      return {
        supabaseWire: false,
        connectorReply:
          "Add **RevenueCat** from the Integrations marketplace and connect it when you're ready to charge.",
      };
    }
  }

  return { supabaseWire: false, connectorReply: null };
}
