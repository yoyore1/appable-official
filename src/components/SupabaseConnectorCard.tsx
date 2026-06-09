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
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50">
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
                      Table setup failed. Reconnect or fix in Supabase dashboard.
                    </p>
                  )}
                  {connector.status === "connected" && connector.schemaVersion >= 1 && (
                    <p className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Profiles ready · run Build to wire sign-in
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-0.5 text-[10px] leading-snug text-warmgrey">
                  Accounts and database for {appName}. You keep your Supabase project.
                </p>
              )}
            </div>
          </div>
        )}

        {embedded && connected && (
          <div className="space-y-2">
            <p className="truncate text-[10px] text-warmgrey">{connector.url}</p>
            {connector.status === "setup_failed" && (
              <p className="text-[10px] text-amber-800">
                Table setup failed. Reconnect or fix in Supabase dashboard.
              </p>
            )}
            {connector.status === "connected" && connector.schemaVersion >= 1 && (
              <p className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Profiles ready · run Build to wire sign-in
              </p>
            )}
          </div>
        )}

        {embedded && !connected && (
          <p className="text-[10px] leading-relaxed text-warmgrey">
            Accounts and database for {appName}. You keep your Supabase project.
          </p>
        )}

        <div className={cn("flex flex-wrap gap-2", embedded ? "mt-3" : "mt-2")}>
          {connected ? (
            <>
              <a
                href={`https://supabase.com/dashboard/project/${connector.projectRef}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-charcoal px-3 py-2 text-[10px] font-semibold text-white transition hover:brightness-110"
              >
                Open dashboard
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() => void disconnect()}
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-line/40 bg-white px-3 py-2 text-[10px] font-semibold text-warmgrey transition hover:border-red-200 hover:text-red-700"
              >
                <Unplug className="h-3 w-3" />
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="w-full rounded-xl bg-emerald-600 px-3 py-2.5 text-[11px] font-semibold text-white transition hover:bg-emerald-700"
            >
              Connect Supabase
            </button>
          )}
        </div>

        {connected && connector.status === "connected" && (
          <ConnectorWebhookHints projectId={projectId} showSupabase embedded />
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
