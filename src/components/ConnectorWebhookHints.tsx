"use client";

import { useEffect, useState } from "react";
import { CopyableValue } from "@/components/CopyableValue";
import { getConnectorWebhookSecrets } from "@/server/connectors";
import { cn } from "@/lib/utils";

export function ConnectorWebhookHints({
  projectId,
  showRevenueCat,
  showSupabase,
  embedded = false,
  className,
}: {
  projectId: string;
  showRevenueCat?: boolean;
  showSupabase?: boolean;
  embedded?: boolean;
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
    <div
      className={cn(
        embedded ? "mt-3 space-y-3 border-t border-line/15 pt-3" : "mt-2 space-y-2",
        className
      )}
    >
      {showRevenueCat && data.revenueCat && (
        <div className="rounded-xl border border-line/20 bg-sand/30 p-2.5">
          <p className="text-[10px] font-semibold text-charcoal">RevenueCat webhook</p>
          <p className="mt-1 text-[10px] leading-relaxed text-warmgrey">
            In RevenueCat, open Project → Integrations → Webhooks. Paste the URL and
            authorization header below.
          </p>
          <div className="mt-2 space-y-1.5">
            <CopyableValue label="URL" value={data.revenueCat.webhookUrl} />
            <CopyableValue label="Authorization" value={data.revenueCat.authorization} />
          </div>
        </div>
      )}
      {showSupabase && data.supabase?.webhookUrl && (
        <div className="rounded-xl border border-line/20 bg-sand/30 p-2.5">
          <p className="text-[10px] font-semibold text-charcoal">Supabase webhook</p>
          <p className="mt-1 text-[10px] leading-relaxed text-warmgrey">
            In Supabase, add a webhook on{" "}
            <code className="rounded bg-white/80 px-1 text-charcoal">appable_profiles</code> for
            INSERT events. Use the secret header below.
          </p>
          <div className="mt-2 space-y-1.5">
            <CopyableValue label="URL" value={data.supabase.webhookUrl} />
            <CopyableValue label="Webhook secret" value={data.supabase.secret} />
          </div>
        </div>
      )}
    </div>
  );
}
