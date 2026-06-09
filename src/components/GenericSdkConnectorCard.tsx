"use client";

import { useState } from "react";
import { Loader2, MessageCircle, Plug, Unplug } from "lucide-react";
import type { ConnectorId } from "@/lib/connectors/catalog";
import { getConnectorDefinition } from "@/lib/connectors/registry";
import { getSdkSpec } from "@/lib/connectors/sdkCatalog";
import type { SdkConnectorPublic } from "@/lib/types";
import { GenericSdkConnectModal } from "@/components/GenericSdkConnectModal";
import { disconnectSdkIntegration } from "@/server/connectors";

export function GenericSdkConnectorCard({
  projectId,
  appName,
  connectorId,
  connector,
  onChange,
  onIntegrationPrompt,
  compact,
}: {
  projectId: string;
  appName: string;
  connectorId: ConnectorId;
  connector: SdkConnectorPublic | null;
  onChange: (next: SdkConnectorPublic | null) => void;
  onIntegrationPrompt: (id: ConnectorId, kind: "explain" | "added") => void;
  compact?: boolean;
}) {
  const def = getConnectorDefinition(connectorId);
  const spec = getSdkSpec(connectorId);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const connected = connector?.status === "connected";

  async function disconnect() {
    setBusy(true);
    try {
      const res = await disconnectSdkIntegration(projectId, connectorId);
      if (res.ok) onChange(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={compact ? "space-y-3" : "space-y-3"}>
        <p className="text-[10px] leading-relaxed text-warmgrey">{def.role}</p>

        {connected && connector && (
          <div
            className={`rounded-xl border px-2.5 py-2 text-[10px] ${
              connector.reportsReady
                ? "border-emerald-200/60 bg-emerald-50/80 text-emerald-900"
                : "border-coral/25 bg-coral/[0.06] text-coral-deep"
            }`}
          >
            <span className="font-semibold">Weekly reports: </span>
            {connector.reportsReady
              ? "Ready. Charts will show in Reports."
              : "Add your Reports key so Appable can show charts here."}
          </div>
        )}

        {connected && connector && (
          <dl className="space-y-1.5 rounded-xl border border-line/20 bg-sand/25 px-3 py-2.5">
            {spec.fields.map((field) => {
              const hint = connector.hints[field.id];
              if (!hint) return null;
              return (
                <div key={field.id} className="flex justify-between gap-3 text-[10px]">
                  <dt className="text-warmgrey">{field.label}</dt>
                  <dd className="font-mono text-[9px] font-semibold text-charcoal">{hint}</dd>
                </div>
              );
            })}
          </dl>
        )}

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onIntegrationPrompt(connectorId, "explain")}
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-line/35 bg-white py-2.5 text-[10px] font-semibold text-charcoal transition hover:bg-sand/40"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Explain
            </button>
            <button
              type="button"
              onClick={() => onIntegrationPrompt(connectorId, "added")}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-charcoal py-2.5 text-[10px] font-semibold text-white transition hover:brightness-110"
            >
              <Plug className="h-3.5 w-3.5" />
              Add to app
            </button>
          </div>

          {connected ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void disconnect()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-line/35 py-2.5 text-[10px] font-semibold text-warmgrey transition hover:border-red-200 hover:text-red-700 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Unplug className="h-3.5 w-3.5" />
              )}
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="w-full rounded-xl border border-dashed border-line/45 bg-white py-2.5 text-[10px] font-semibold text-charcoal transition hover:border-charcoal/25 hover:bg-sand/30"
            >
              Enter API keys and connect
            </button>
          )}
        </div>
      </div>

      <GenericSdkConnectModal
        projectId={projectId}
        connectorId={connectorId}
        appName={appName}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConnected={(next) => {
          onChange(next);
          setModalOpen(false);
        }}
      />
    </>
  );
}
