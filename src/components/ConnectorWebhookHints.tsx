"use client";

import { useEffect, useState } from "react";
import { CopyableValue } from "@/components/CopyableValue";
import { getConnectorWebhookSecrets } from "@/server/connectors";
import { cn } from "@/lib/utils";

export function ConnectorWebhookHints({
  projectId,
  showRevenueCat,
  showSupabase,
  className,
}: {
  projectId: string;
  showRevenueCat?: boolean;
  showSupabase?: boolean;
  className?: string;
}) {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof getConnectorWebhookSecrets>
  > | null>(null);

  useEffect(() => {
    if (!showRevenueCat && !showSupabase) return;
    void getConnectorWebhookSecrets(projectId).then(setData);
  }, [projectId, showRevenueCat, showSupabase]);

  if (!data || !data.ok) return null;

  return (
    <div className={cn("mt-2 space-y-2", className)}>
      {showRevenueCat && data.revenueCat && (
        <div>
          <p className="mb-1 text-[9px] font-semibold text-charcoal">RevenueCat webhook</p>
          <p className="mb-1.5 text-[9px] leading-snug text-warmgrey">
            RevenueCat → Project → Integrations → Webhooks. Paste URL + Authorization header.
          </p>
          <div className="space-y-1.5">
            <CopyableValue label="URL" value={data.revenueCat.webhookUrl} />
            <CopyableValue label="Authorization" value={data.revenueCat.authorization} />
          </div>
        </div>
      )}
      {showSupabase && data.supabase?.webhookUrl && (
        <div>
          <p className="mb-1 text-[9px] font-semibold text-charcoal">Supabase webhook</p>
          <p className="mb-1.5 text-[9px] leading-snug text-warmgrey">
            Supabase → Database → Webhooks on{" "}
            <code className="text-charcoal">appable_profiles</code> INSERT. Header{" "}
            <code className="text-charcoal">x-appable-webhook-secret</code>.
          </p>
          <div className="space-y-1.5">
            <CopyableValue label="URL" value={data.supabase.webhookUrl} />
            <CopyableValue label="x-appable-webhook-secret" value={data.supabase.secret} />
          </div>
        </div>
      )}
    </div>
  );
}
