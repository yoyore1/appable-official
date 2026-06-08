"use client";

import { useState } from "react";
import { Database, ExternalLink, Unplug } from "lucide-react";
import { ConnectorWebhookHints } from "@/components/ConnectorWebhookHints";
import { SupabaseConnectModal } from "@/components/SupabaseConnectModal";
import { disconnectSupabaseFromProject } from "@/server/connectors";
import type { SupabaseConnectorPublic } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SupabaseConnectorCard({
  projectId,
  appName,
  connector,
  onChange,
  compact = false,
  embedded = false,
}: {
  projectId: string;
  appName: string;
  connector: SupabaseConnectorPublic | null;
  onChange: (next: SupabaseConnectorPublic | null) => void;
  compact?: boolean;
  /** Inside ConnectorAccordion — no outer chrome or title row */
  embedded?: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const connected = connector && connector.status !== "disconnected";

  async function disconnect() {
    if (!confirm("Disconnect Supabase from this app?")) return;
    setBusy(true);
    try {
      const res = await disconnectSupabaseFromProject(projectId);
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
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#3ECF8E]/15 text-[#1a7f4e]">
              <Database className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-charcoal">Supabase</p>
              {connected ? (
                <>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-charcoal">
                    {connector.projectName}
                  </p>
                  <p className="truncate text-[10px] text-warmgrey">{connector.url}</p>
                  {connector.status === "setup_failed" && (
                    <p className="mt-1 text-[10px] text-amber-800">
                      Table setup failed — reconnect or fix in Supabase dashboard.
                    </p>
                  )}
                  {connector.status === "connected" && connector.schemaVersion >= 1 && (
                    <p className="mt-1 text-[10px] text-moss">
                      Profiles table ready · run full build to wire auth UI
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-0.5 text-[10px] leading-snug text-warmgrey">
                  Accounts & database for {appName}. You keep your Supabase project — we connect
                  securely.
                </p>
              )}
            </div>
          </div>
        )}

        {embedded && connected && (
          <div className="space-y-1">
            <p className="truncate text-[10px] text-warmgrey">{connector.url}</p>
            {connector.status === "setup_failed" && (
              <p className="text-[10px] text-amber-800">
                Table setup failed — reconnect or fix in Supabase dashboard.
              </p>
            )}
            {connector.status === "connected" && connector.schemaVersion >= 1 && (
              <p className="text-[10px] text-moss">
                Profiles table ready · run full build to wire auth UI
              </p>
            )}
          </div>
        )}

        {embedded && !connected && (
          <p className="text-[10px] leading-snug text-warmgrey">
            Accounts & database for {appName}. You keep your Supabase project — we connect
            securely.
          </p>
        )}

        <div className={cn("flex flex-wrap gap-1.5", !embedded && "mt-2", embedded && "mt-2")}>
          {connected ? (
            <>
              <a
                href={`https://supabase.com/dashboard/project/${connector.projectRef}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-line/40 px-2 py-1 text-[10px] font-semibold text-charcoal hover:bg-sand/60"
              >
                Open dashboard
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
              className="rounded-lg bg-[#3ECF8E] px-3 py-1.5 text-[10px] font-bold text-[#0d3d24] transition hover:brightness-95"
            >
              Connect Supabase
            </button>
          )}
        </div>

        {connected && connector.status === "connected" && (
          <ConnectorWebhookHints projectId={projectId} showSupabase />
        )}
      </div>

      <SupabaseConnectModal
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
