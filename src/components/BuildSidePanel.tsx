"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ClipboardList, CreditCard, Database, Link2, Smartphone } from "lucide-react";
import { ConnectorAccordion } from "@/components/ConnectorAccordion";
import { ConnectorRecommendations } from "@/components/ConnectorRecommendations";
import { OAuthSetupGuide } from "@/components/OAuthSetupGuide";
import type { ConnectorId, ConnectorRecommendation } from "@/lib/connectors/registry";
import { RailwayConnectorCard } from "@/components/RailwayConnectorCard";
import { RailwayLogo } from "@/components/RailwayLogo";
import { RevenueCatConnectorCard } from "@/components/RevenueCatConnectorCard";
import { SupabaseConnectorCard } from "@/components/SupabaseConnectorCard";
import type {
  RailwayConnectorPublic,
  RevenueCatConnectorPublic,
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
      className="group flex w-full shrink-0 items-center gap-2.5 px-4 py-3 text-left transition hover:bg-white/50"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/80 text-coral shadow-[0_1px_4px_-1px_rgba(43,38,36,0.12)] ring-1 ring-line/30">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-charcoal">{title}</span>
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

export function BuildSidePanel({
  projectId,
  previewToken,
  appName,
  previewReady,
  readinessAudit,
  supabaseConnector,
  revenueCatConnector,
  railwayConnector,
  connectorNeeds = [],
  onSupabaseConnectorChange,
  onRevenueCatConnectorChange,
  onRailwayConnectorChange,
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
  connectorNeeds?: ConnectorId[];
  onSupabaseConnectorChange: (next: SupabaseConnectorPublic | null) => void;
  onRevenueCatConnectorChange: (next: RevenueCatConnectorPublic | null) => void;
  onRailwayConnectorChange: (next: RailwayConnectorPublic | null) => void;
  connectorRecommendations?: ConnectorRecommendation[];
  chatMode: "brainstorm" | "build";
  onAskAbout: (item: ReadinessItem) => void;
  onDecision: (item: ReadinessItem, decision: ReadinessDecision) => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(true);
  const [checklistOpen, setChecklistOpen] = useState(true);

  const supabaseConnected =
    Boolean(supabaseConnector) && supabaseConnector!.status !== "disconnected";
  const revenueCatConnected = revenueCatConnector?.status === "connected";
  const railwayConnected = railwayConnector?.status === "connected";
  const railwayRelevant =
    railwayConnected || connectorNeeds.includes("railway");
  const topRec = connectorRecommendations[0]?.id;

  const [supabaseAccordionOpen, setSupabaseAccordionOpen] = useState(
    () => topRec === "supabase" || !supabaseConnected
  );
  const [revenueCatAccordionOpen, setRevenueCatAccordionOpen] = useState(
    () => topRec === "revenuecat"
  );
  const [railwayAccordionOpen, setRailwayAccordionOpen] = useState(
    () => topRec === "railway"
  );

  const showChecklist = Boolean(readinessAudit && previewReady);

  const connectionsSubtitle =
    [
      supabaseConnector?.status === "connected" ? "Supabase" : null,
      revenueCatConnector?.status === "connected" ? "RevenueCat" : null,
      railwayConnector?.status === "connected" ? "Railway" : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Link backend services";

  const checklistSubtitle = readinessAudit
    ? `${readinessAudit.discussedCount} discussed · ${readinessAudit.missingCount} to plan`
    : undefined;

  return (
    <aside className="chat-panel-surface hidden h-full min-h-0 flex-col overflow-hidden xl:flex">
      {/* One scroll region — connections + checklist can be tall; headers stay visible above. */}
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
          <div id="phone-preview-panel" className="border-b border-line/20 px-4 pb-4">
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
              title="Connections"
              subtitle={connectionsSubtitle}
              icon={<Link2 className="h-3.5 w-3.5" />}
              open={connectionsOpen}
              onToggle={() => setConnectionsOpen((v) => !v)}
            />
            {connectionsOpen && (
              <div id="connections-panel" className="space-y-2 border-b border-line/20 px-4 pb-4">
                {connectorRecommendations.length > 0 && (
                  <ConnectorRecommendations recommendations={connectorRecommendations} />
                )}
                <ConnectorAccordion
                  id="connector-supabase"
                  title="Supabase"
                  subtitle={
                    supabaseConnected
                      ? (supabaseConnector!.projectName ?? supabaseConnector!.url)
                      : "Accounts & database"
                  }
                  icon={
                    <span className="grid h-full w-full place-items-center rounded-lg bg-[#3ECF8E]/15 text-[#1a7f4e]">
                      <Database className="h-4 w-4" />
                    </span>
                  }
                  open={supabaseAccordionOpen}
                  onToggle={() => setSupabaseAccordionOpen((v) => !v)}
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

                <ConnectorAccordion
                  id="connector-revenuecat"
                  title="RevenueCat"
                  subtitle={
                    revenueCatConnected
                      ? `Key ${revenueCatConnector!.publicApiKeyHint}`
                      : "Subscriptions & in-app purchases"
                  }
                  icon={
                    <span className="grid h-full w-full place-items-center rounded-lg bg-[#6366F1]/15 text-[#4338CA]">
                      <CreditCard className="h-4 w-4" />
                    </span>
                  }
                  open={revenueCatAccordionOpen}
                  onToggle={() => setRevenueCatAccordionOpen((v) => !v)}
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

                {railwayRelevant && (
                  <ConnectorAccordion
                    id="connector-railway"
                    title="Railway"
                    subtitle={
                      railwayConnected
                        ? railwayConnector!.serviceUrl
                        : "Custom API & workers"
                    }
                    icon={
                      <span className="grid h-full w-full place-items-center rounded-lg bg-[#0B0D0E] text-white">
                        <RailwayLogo className="h-4 w-4" />
                      </span>
                    }
                    open={railwayAccordionOpen}
                    onToggle={() => setRailwayAccordionOpen((v) => !v)}
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
    </aside>
  );
}
