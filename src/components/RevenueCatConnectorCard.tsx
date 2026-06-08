"use client";

import { useState } from "react";
import { CreditCard, Unplug } from "lucide-react";
import { RevenueCatConnectModal } from "@/components/RevenueCatConnectModal";
import { ConnectorWebhookHints } from "@/components/ConnectorWebhookHints";
import { disconnectRevenueCatFromProject } from "@/server/connectors";
import type { RevenueCatConnectorPublic } from "@/lib/types";
import { cn } from "@/lib/utils";

export function RevenueCatConnectorCard({
  projectId,
  appName,
  connector,
  supabaseConnected,
  onChange,
  compact = false,
  embedded = false,
}: {
  projectId: string;
  appName: string;
  connector: RevenueCatConnectorPublic | null;
  supabaseConnected: boolean;
  onChange: (next: RevenueCatConnectorPublic | null) => void;
  compact?: boolean;
  embedded?: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const connected = connector?.status === "connected";

  async function disconnect() {
    if (!confirm("Disconnect RevenueCat from this app?")) return;
    setBusy(true);
    try {
      const res = await disconnectRevenueCatFromProject(projectId);
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
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#6366F1]/15 text-[#4338CA]">
              <CreditCard className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-charcoal">RevenueCat</p>
              {connected ? (
                <>
                  <p className="mt-0.5 text-[11px] font-semibold text-charcoal">
                    Subscriptions linked
                  </p>
                  <p className="text-[10px] text-warmgrey">Key {connector.publicApiKeyHint}</p>
                  {!supabaseConnected && (
                    <p className="mt-1 text-[10px] text-amber-800">
                      Connect Supabase too — webhooks write to appable_subscriptions.
                    </p>
                  )}
                  {connector.webhooksConfigured ? (
                    <p className="mt-1 text-[10px] text-moss">Webhook receiving events</p>
                  ) : (
                    <p className="mt-1 text-[10px] text-warmgrey">
                      Paste webhook below in RevenueCat dashboard
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-0.5 text-[10px] leading-snug text-warmgrey">
                  In-app purchases & subscriptions for {appName}. Syncs with Supabase via webhooks.
                </p>
              )}
            </div>
          </div>
        )}

        {embedded && connected && (
          <div className="space-y-1">
            <p className="text-[10px] text-warmgrey">Key {connector.publicApiKeyHint}</p>
            {!supabaseConnected && (
              <p className="text-[10px] text-amber-800">
                Connect Supabase too — webhooks write to appable_subscriptions.
              </p>
            )}
            {connector.webhooksConfigured ? (
              <p className="text-[10px] text-moss">Webhook receiving events</p>
            ) : (
              <p className="text-[10px] text-warmgrey">
                Paste webhook below in RevenueCat dashboard
              </p>
            )}
          </div>
        )}

        {embedded && !connected && (
          <p className="text-[10px] leading-snug text-warmgrey">
            In-app purchases & subscriptions for {appName}. Syncs with Supabase via webhooks.
          </p>
        )}

        <div className={cn("flex flex-wrap gap-1.5", "mt-2")}>
          {connected ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void disconnect()}
              className="inline-flex items-center gap-1 rounded-lg border border-line/40 px-2 py-1 text-[10px] font-semibold text-warmgrey hover:border-red-200 hover:text-red-700"
            >
              <Unplug className="h-3 w-3" />
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-[#6366F1] px-3 py-1.5 text-[10px] font-bold text-white transition hover:brightness-95"
            >
              Connect RevenueCat
            </button>
          )}
        </div>

        {connected && (
          <ConnectorWebhookHints projectId={projectId} showRevenueCat />
        )}
      </div>

      <RevenueCatConnectModal
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
