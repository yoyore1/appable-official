"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Loader2, X } from "lucide-react";
import type { ConnectorId } from "@/lib/connectors/catalog";
import { getConnectorDefinition } from "@/lib/connectors/registry";
import { APP_KEYS_INTRO, REPORTS_KEYS_INTRO } from "@/lib/connectors/credentialTiers";
import { appTierFields, getSdkSpec, reportsTierFields } from "@/lib/connectors/sdkCatalog";
import { SdkCredentialFields } from "@/components/SdkCredentialFields";
import type { SdkConnectorPublic } from "@/lib/types";
import { connectSdkIntegration } from "@/server/connectors";

type Step = "form" | "connecting" | "done";

export function GenericSdkConnectModal({
  projectId,
  connectorId,
  appName,
  open,
  onClose,
  onConnected,
}: {
  projectId: string;
  connectorId: ConnectorId;
  appName: string;
  open: boolean;
  onClose: () => void;
  onConnected: (connector: SdkConnectorPublic) => void;
}) {
  const spec = useMemo(() => getSdkSpec(connectorId), [connectorId]);
  const def = getConnectorDefinition(connectorId);
  const [step, setStep] = useState<Step>("form");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function reset() {
    setStep("form");
    setValues({});
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function connect() {
    setError(null);
    setStep("connecting");
    const res = await connectSdkIntegration(projectId, connectorId, values);
    if (!res.ok) {
      setError(res.message);
      setStep("form");
      return;
    }
    setStep("done");
    onConnected(res.connector);
  }

  const appFields = appTierFields(spec);
  const reportsFields = reportsTierFields(spec);

  const canSubmit = appFields
    .filter((f) => f.required)
    .every((f) => (values[f.id] ?? "").trim().length >= 2);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-charcoal/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="sdk-connect-title"
    >
      <div className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-line/40 bg-cream p-5 shadow-xl">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-warmgrey hover:bg-sand/80 hover:text-charcoal"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 id="sdk-connect-title" className="pr-8 text-lg font-bold text-charcoal">
          {def.connectionsLabel}
        </h2>
        <p className="mt-1 text-sm text-warmgrey">
          {def.role} Keys are encrypted. App keys ship in{" "}
          <span className="font-semibold text-charcoal">{appName}</span>; Reports keys stay in
          Appable only.
        </p>

        {step === "form" && (
          <div className="mt-4 space-y-3">
            <ol className="list-decimal space-y-2 pl-4 text-xs text-warmgrey">
              {spec.setupSteps.map((stepText) => (
                <li key={stepText}>{stepText}</li>
              ))}
              {spec.dashboardUrl && (
                <li>
                  <a
                    href={spec.dashboardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 font-semibold text-coral-deep hover:underline"
                  >
                    Open dashboard
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
              )}
            </ol>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-warmgrey">
                In your exported app
              </p>
              <p className="text-[10px] leading-snug text-warmgrey">{APP_KEYS_INTRO}</p>
              <SdkCredentialFields
                fields={appFields}
                values={values}
                onChange={setValues}
              />
            </div>

            {reportsFields.length > 0 && (
              <div className="space-y-2 rounded-xl border border-charcoal/10 bg-charcoal/[0.03] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-charcoal">
                  For Appable Reports
                </p>
                <p className="text-[10px] leading-snug text-warmgrey">{REPORTS_KEYS_INTRO}</p>
                <SdkCredentialFields
                  fields={reportsFields}
                  values={values}
                  onChange={setValues}
                />
              </div>
            )}
            {error && (
              <p className="rounded-lg bg-red-50 px-2.5 py-2 text-xs text-red-700">{error}</p>
            )}
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void connect()}
              className="w-full rounded-xl bg-coral py-2.5 text-sm font-bold text-white disabled:opacity-45"
            >
              Save & connect
            </button>
          </div>
        )}

        {step === "connecting" && (
          <div className="mt-8 flex flex-col items-center gap-2 py-6">
            <Loader2 className="h-6 w-6 animate-spin text-coral" />
            <p className="text-sm text-warmgrey">Encrypting and saving…</p>
          </div>
        )}

        {step === "done" && (
          <div className="mt-6 rounded-xl border border-[#3ECF8E]/30 bg-[#3ECF8E]/10 px-3 py-3 text-sm text-charcoal">
            <p className="font-bold">{def.displayName} connected</p>
            <p className="mt-1 text-xs text-warmgrey">
              Keys saved securely. App keys go in export; Reports keys power weekly insights in
              Appable.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-3 w-full rounded-xl border border-line/50 py-2 text-xs font-bold"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
