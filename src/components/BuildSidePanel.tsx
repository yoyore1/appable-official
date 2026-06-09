"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ClipboardList,
  CreditCard,
  Database,
  Link2,
  Smartphone,
  Store,
} from "lucide-react";
import { ConnectorAccordion } from "@/components/ConnectorAccordion";
import { ConnectorMarketplace } from "@/components/ConnectorMarketplace";
import { ConnectorRecommendations } from "@/components/ConnectorRecommendations";
import { OAuthSetupGuide } from "@/components/OAuthSetupGuide";
import type { ConnectorId } from "@/lib/connectors/catalog";
import { connectorAccent } from "@/lib/connectors/connectorThemes";
import {
  getConnectorDefinition,
  type ConnectorRecommendation,
  type ProjectConnectorState,
  visibleConnectorIds,
} from "@/lib/connectors/registry";
import { getConnectorConnectionType } from "@/lib/connectors/sdkCatalog";
import { GenericSdkConnectorCard } from "@/components/GenericSdkConnectorCard";
import { RailwayConnectorCard } from "@/components/RailwayConnectorCard";
import { RailwayLogo } from "@/components/RailwayLogo";
import { RevenueCatConnectorCard } from "@/components/RevenueCatConnectorCard";
import { SupabaseConnectorCard } from "@/components/SupabaseConnectorCard";
import type {
  RailwayConnectorPublic,
  RevenueCatConnectorPublic,
  SdkConnectorPublic,
  SupabaseConnectorPublic,
} from "@/lib/types";
import { ExpoPhoneGuide } from "@/components/ExpoPhoneGuide";
import { ReadinessChecklist } from "@/components/ReadinessChecklist";
import type {
  AppReadinessAudit,
  ReadinessDecision,
  ReadinessItem,
} from "@/lib/expoApp/readinessAudit";
import { cn } from "@/lib/utils";

function PanelHeader({
  id,
  title,
  subtitle,
  icon,
  open,
  onToggle,
}: {
  id: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      id={`${id}-trigger`}
      aria-expanded={open}
      aria-controls={`${id}-panel`}
      onClick={onToggle}
      className="group flex w-full shrink-0 items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/60"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/90 text-coral shadow-[0_2px_8px_-3px_rgba(43,38,36,0.12)] ring-1 ring-line/25">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold tracking-tight text-charcoal">
          {title}
        </span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-[10px] text-warmgrey">{subtitle}</span>
        )}
      </span>
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-warmgrey transition-transform duration-200 group-hover:text-charcoal",
          open && "rotate-180"
        )}
        aria-hidden
      />
    </button>
  );
}

function PlannedConnectorCard({
  id,
  onRemove,
}: {
  id: ConnectorId;
  onRemove: () => void;
}) {
  const def = getConnectorDefinition(id);
  return (
    <div className="rounded-2xl border border-line/25 bg-white/80 px-3 py-3 shadow-sm">
      <p className="text-[11px] font-semibold text-charcoal">{def.displayName}</p>
      <p className="mt-0.5 text-[10px] text-warmgrey">On your plan · connect flow coming soon</p>
      <button
        type="button"
        onClick={onRemove}
        className="mt-1.5 text-[9px] font-bold text-warmgrey hover:text-charcoal"
      >
        Remove
      </button>
    </div>
  );
}

export function BuildSidePanel({
  projectId,
  previewToken,
  appName,
  previewReady,
  readinessAudit,
  supabaseConnector,
  revenueCatConnector,
  railwayConnector,
  sdkConnectors = {},
  marketplaceSelections = [],
  connectorSuggestions = [],
  onSupabaseConnectorChange,
  onRevenueCatConnectorChange,
  onRailwayConnectorChange,
  onSdkConnectorChange,
  onMarketplaceSelectionsChange,
  onIntegrationPrompt,
  connectorRecommendations = [],
  chatMode,
  onAskAbout,
  onDecision,
}: {
  projectId: string;
  previewToken: string | null;
  appName: string;
  previewReady: boolean;
  readinessAudit: AppReadinessAudit | null;
  supabaseConnector: SupabaseConnectorPublic | null;
  revenueCatConnector: RevenueCatConnectorPublic | null;
  railwayConnector: RailwayConnectorPublic | null;
  sdkConnectors?: Partial<Record<ConnectorId, SdkConnectorPublic | null>>;
  marketplaceSelections?: ConnectorId[];
  connectorSuggestions?: ConnectorId[];
  onSupabaseConnectorChange: (next: SupabaseConnectorPublic | null) => void;
  onRevenueCatConnectorChange: (next: RevenueCatConnectorPublic | null) => void;
  onRailwayConnectorChange: (next: RailwayConnectorPublic | null) => void;
  onSdkConnectorChange: (id: ConnectorId, next: SdkConnectorPublic | null) => void;
  onMarketplaceSelectionsChange: (next: ConnectorId[]) => void;
  /** Fill chat with explain (brainstorm) or implement (build) prompt for this integration. */
  onIntegrationPrompt: (id: ConnectorId, kind: "explain" | "added") => void;
  connectorRecommendations?: ConnectorRecommendation[];
  chatMode: "brainstorm" | "build";
  onAskAbout: (item: ReadinessItem) => void;
  onDecision: (item: ReadinessItem, decision: ReadinessDecision) => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(true);
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [marketplaceBusy, setMarketplaceBusy] = useState<ConnectorId | null>(null);

  const connectorState: ProjectConnectorState = useMemo(
    () => ({
      supabase: supabaseConnector,
      revenueCat: revenueCatConnector,
      railway: railwayConnector,
      sdk: sdkConnectors,
    }),
    [supabaseConnector, revenueCatConnector, railwayConnector, sdkConnectors]
  );

  const visibleIds = useMemo(
    () => visibleConnectorIds(connectorState, marketplaceSelections),
    [connectorState, marketplaceSelections]
  );

  const supabaseConnected =
    Boolean(supabaseConnector) && supabaseConnector!.status !== "disconnected";
  const revenueCatConnected = revenueCatConnector?.status === "connected";
  const railwayConnected = railwayConnector?.status === "connected";

  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});

  function toggleConnectorAccordion(id: ConnectorId) {
    setOpenAccordions((prev) => {
      const isOpen = prev[id] ?? id === "supabase";
      if (isOpen) return { ...prev, [id]: false };
      const next: Record<string, boolean> = {};
      for (const vid of visibleIds) next[vid] = vid === id;
      return { ...prev, ...next };
    });
  }

  const showChecklist = Boolean(readinessAudit && previewReady);

  const connectionsSubtitle =
    visibleIds.length > 0
      ? `${visibleIds.length} on your project`
      : "Browse the marketplace";

  const checklistSubtitle = readinessAudit
    ? `${readinessAudit.discussedCount} discussed · ${readinessAudit.missingCount} to plan`
    : undefined;

  async function toggleMarketplaceSelection(id: ConnectorId, selected: boolean) {
    setMarketplaceBusy(id);
    try {
      const { setMarketplaceSelection } = await import("@/server/connectors");
      const res = await setMarketplaceSelection(projectId, id, selected);
      if (res.ok) {
        onMarketplaceSelectionsChange(res.selections);
        if (selected) {
          onIntegrationPrompt(id, "added");
          setMarketplaceOpen(false);
        }
      }
    } finally {
      setMarketplaceBusy(null);
    }
  }

  function renderConnectable(id: ConnectorId) {
    if (id === "supabase") {
      return (
        <ConnectorAccordion
          key={id}
          id="connector-supabase"
          title="Supabase"
          accent={connectorAccent(id)}
          subtitle={
            supabaseConnected
              ? (supabaseConnector!.projectName ?? supabaseConnector!.url)
              : "Accounts & database"
          }
          icon={<Database className="h-4 w-4" />}
          open={openAccordions[id] ?? id === "supabase"}
          onToggle={() => toggleConnectorAccordion(id)}
          connected={supabaseConnected}
        >
          <SupabaseConnectorCard
            projectId={projectId}
            appName={appName}
            connector={supabaseConnector}
            onChange={onSupabaseConnectorChange}
            compact
            embedded
          />
          {supabaseConnector?.status === "connected" && (
            <OAuthSetupGuide connector={supabaseConnector} compact />
          )}
        </ConnectorAccordion>
      );
    }

    if (id === "revenuecat") {
      return (
        <ConnectorAccordion
          key={id}
          id="connector-revenuecat"
          title="RevenueCat"
          accent={connectorAccent(id)}
          subtitle={
            revenueCatConnected
              ? `Key ${revenueCatConnector!.publicApiKeyHint}`
              : "Subscriptions & in-app purchases"
          }
          icon={<CreditCard className="h-4 w-4" />}
          open={openAccordions[id] ?? false}
          onToggle={() => toggleConnectorAccordion(id)}
          connected={revenueCatConnected}
        >
          <RevenueCatConnectorCard
            projectId={projectId}
            appName={appName}
            connector={revenueCatConnector}
            supabaseConnected={supabaseConnector?.status === "connected"}
            onChange={onRevenueCatConnectorChange}
            compact
            embedded
          />
        </ConnectorAccordion>
      );
    }

    if (id === "railway") {
      return (
        <ConnectorAccordion
          key={id}
          id="connector-railway"
          title="Railway"
          accent={connectorAccent(id)}
          subtitle={
            railwayConnected ? railwayConnector!.serviceUrl : "Custom API & workers"
          }
          icon={<RailwayLogo className="h-4 w-4" />}
          open={openAccordions[id] ?? false}
          onToggle={() => toggleConnectorAccordion(id)}
          connected={railwayConnected}
        >
          <RailwayConnectorCard
            projectId={projectId}
            appName={appName}
            connector={railwayConnector}
            onChange={onRailwayConnectorChange}
            compact
            embedded
          />
        </ConnectorAccordion>
      );
    }

    if (getConnectorConnectionType(id) === "sdk") {
      const def = getConnectorDefinition(id);
      const sdk = sdkConnectors[id] ?? null;
      const connected = sdk?.status === "connected";
      return (
        <ConnectorAccordion
          key={id}
          id={`connector-${id}`}
          title={def.displayName}
          accent={connectorAccent(id)}
          subtitle={
            connected
              ? Object.values(sdk!.hints)[0] ?? "Connected"
              : def.connectionsLabel
          }
          icon={
            <span className="text-[10px] font-bold tracking-tight">
              {def.displayName.slice(0, 2).toUpperCase()}
            </span>
          }
          open={openAccordions[id] ?? false}
          onToggle={() => toggleConnectorAccordion(id)}
          connected={connected}
        >
          <GenericSdkConnectorCard
            projectId={projectId}
            appName={appName}
            connectorId={id}
            connector={sdk}
            onChange={(next) => onSdkConnectorChange(id, next)}
            onIntegrationPrompt={onIntegrationPrompt}
            compact
          />
        </ConnectorAccordion>
      );
    }

    return (
      <PlannedConnectorCard
        key={id}
        id={id}
        onRemove={() => void toggleMarketplaceSelection(id, false)}
      />
    );
  }

  return (
    <aside className="chat-panel-surface hidden h-full min-h-0 flex-col overflow-hidden xl:flex">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <PanelHeader
          id="phone-preview"
          title="Preview on your phone"
          subtitle="Test touch & native features on a real device"
          icon={<Smartphone className="h-3.5 w-3.5" />}
          open={previewOpen}
          onToggle={() => setPreviewOpen((v) => !v)}
        />
        {previewOpen && (
          <div id="phone-preview-panel" className="border-b border-line/15 px-4 pb-5 pt-1">
            <ExpoPhoneGuide
              projectId={projectId}
              previewToken={previewToken}
              appName={appName}
              ready={previewReady}
              compact
              embedded
            />
          </div>
        )}

        {previewReady && (
          <>
            <PanelHeader
              id="connections"
              title="Integrations"
              subtitle={connectionsSubtitle}
              icon={<Link2 className="h-3.5 w-3.5" />}
              open={connectionsOpen}
              onToggle={() => setConnectionsOpen((v) => !v)}
            />
            {connectionsOpen && (
              <div id="connections-panel" className="space-y-3 border-b border-line/15 px-4 pb-5 pt-1">
                <button
                  type="button"
                  onClick={() => setMarketplaceOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-charcoal px-4 py-3 text-[11px] font-semibold text-white shadow-[0_4px_18px_-6px_rgba(43,38,36,0.45)] transition hover:brightness-110"
                >
                  <Store className="h-4 w-4" />
                  Browse marketplace
                </button>

                {connectorRecommendations.length > 0 && (
                  <ConnectorRecommendations
                    recommendations={connectorRecommendations}
                    onBrowse={() => setMarketplaceOpen(true)}
                  />
                )}

                {visibleIds.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-line/35 bg-white/60 px-4 py-5 text-center text-[11px] leading-relaxed text-warmgrey">
                    No integrations yet. Open the marketplace and add only what you want.
                    Nothing connects automatically.
                  </p>
                ) : (
                  <div className="space-y-2.5">{visibleIds.map((id) => renderConnectable(id))}</div>
                )}
              </div>
            )}
          </>
        )}

        {showChecklist && readinessAudit && (
          <>
            <PanelHeader
              id="launch-checklist"
              title="Launch checklist"
              subtitle={checklistSubtitle}
              icon={<ClipboardList className="h-3.5 w-3.5" />}
              open={checklistOpen}
              onToggle={() => setChecklistOpen((v) => !v)}
            />
            {checklistOpen && (
              <div
                id="launch-checklist-panel"
                role="region"
                aria-labelledby="launch-checklist-trigger"
                className="px-4 pb-6 pt-1"
              >
                <ReadinessChecklist
                  audit={readinessAudit}
                  chatMode={chatMode}
                  onAskAbout={onAskAbout}
                  onDecision={onDecision}
                  embedded
                />
              </div>
            )}
          </>
        )}
      </div>

      <ConnectorMarketplace
        open={marketplaceOpen}
        onClose={() => setMarketplaceOpen(false)}
        state={connectorState}
        selections={marketplaceSelections}
        suggestions={connectorSuggestions}
        busyId={marketplaceBusy}
        onToggleSelection={(id, selected) => void toggleMarketplaceSelection(id, selected)}
        onExplain={(id) => {
          onIntegrationPrompt(id, "explain");
          setMarketplaceOpen(false);
        }}
      />
    </aside>
  );
}
