"use client";

import { useState } from "react";
import { ExternalLink, Unplug } from "lucide-react";
import { RailwayConnectModal } from "@/components/RailwayConnectModal";
import { RailwayLogo } from "@/components/RailwayLogo";
import { disconnectRailwayFromProject } from "@/server/connectors";
import type { RailwayConnectorPublic } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RailwayConnectorCard({
  projectId,
  appName,
  connector,
  onChange,
  compact = false,
  embedded = false,
}: {
  projectId: string;
  appName: string;
  connector: RailwayConnectorPublic | null;
  onChange: (next: RailwayConnectorPublic | null) => void;
  compact?: boolean;
  embedded?: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const connected = connector?.status === "connected";

  async function disconnect() {
    if (!confirm("Disconnect Railway from this app?")) return;
    setBusy(true);
    try {
      const res = await disconnectRailwayFromProject(projectId);
      if (res.ok) onChange(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={cn(!embedded && "rounded-xl border border-line/35 bg-white/80", compact ? "p-2.5" : !embedded && "p-3")}>
        {!embedded && (
          <div className="flex items-start gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#0B0D0E] text-white">
              <RailwayLogo className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-charcoal">Railway</p>
              {connected ? (
                <>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-charcoal">
                    {connector.serviceUrl}
                  </p>
                  <p className="text-[10px] text-warmgrey">{connector.accountHint}</p>
                </>
              ) : (
                <p className="mt-0.5 text-[10px] leading-snug text-warmgrey">
                  Custom API hosting for {appName} — only if you need server code beyond Supabase.
                </p>
              )}
            </div>
          </div>
        )}

        {embedded && connected && (
          <div className="space-y-1">
            <p className="truncate text-[10px] font-semibold text-charcoal">{connector.serviceUrl}</p>
            <p className="text-[10px] text-warmgrey">{connector.accountHint}</p>
          </div>
        )}

        {embedded && !connected && (
          <p className="text-[10px] leading-snug text-warmgrey">
            Custom API hosting for {appName} — only if you need server code beyond Supabase.
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-1.5">
          {connected ? (
            <>
              <a
                href={connector.serviceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-line/40 px-2 py-1 text-[10px] font-semibold text-charcoal hover:bg-sand/60"
              >
                Open service
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() => void disconnect()}
                className="inline-flex items-center gap-1 rounded-lg border border-line/40 px-2 py-1 text-[10px] font-semibold text-warmgrey hover:border-red-200 hover:text-red-700"
              >
                <Unplug className="h-3 w-3" />
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-[#0B0D0E] px-3 py-1.5 text-[10px] font-bold text-white transition hover:brightness-110"
            >
              Connect Railway
            </button>
          )}
        </div>
      </div>

      <RailwayConnectModal
        projectId={projectId}
        appName={appName}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConnected={(c) => {
          onChange(c);
          setModalOpen(false);
        }}
      />
    </>
  );
}
