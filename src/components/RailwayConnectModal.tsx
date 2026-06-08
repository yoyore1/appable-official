"use client";

import { useState } from "react";
import { ExternalLink, Loader2, X } from "lucide-react";
import { connectRailwayToProject } from "@/server/connectors";
import type { RailwayConnectorPublic } from "@/lib/types";

const RAILWAY_TOKENS_URL = "https://railway.com/account/tokens";
const RAILWAY_DASHBOARD_URL = "https://railway.com/dashboard";

type Step = "form" | "connecting" | "done";

export function RailwayConnectModal({
  projectId,
  appName,
  open,
  onClose,
  onConnected,
}: {
  projectId: string;
  appName: string;
  open: boolean;
  onClose: () => void;
  onConnected: (connector: RailwayConnectorPublic) => void;
}) {
  const [step, setStep] = useState<Step>("form");
  const [apiToken, setApiToken] = useState("");
  const [serviceUrl, setServiceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RailwayConnectorPublic | null>(null);

  if (!open) return null;

  function reset() {
    setStep("form");
    setApiToken("");
    setServiceUrl("");
    setError(null);
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function connect() {
    setError(null);
    setStep("connecting");
    const res = await connectRailwayToProject(projectId, apiToken, serviceUrl);
    if (!res.ok) {
      setError(res.message);
      setStep("form");
      return;
    }
    setResult(res.connector);
    setStep("done");
    onConnected(res.connector);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="railway-connect-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-line/40 bg-cream p-5 shadow-xl">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-warmgrey hover:bg-sand/80 hover:text-charcoal"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 id="railway-connect-title" className="pr-8 text-lg font-bold text-charcoal">
          Connect Railway
        </h2>
        <p className="mt-1 text-sm text-warmgrey">
          Host a custom API or worker for <span className="font-semibold text-charcoal">{appName}</span>
          . Use this only when you need server logic beyond Supabase.
        </p>

        {step === "form" && (
          <div className="mt-4 space-y-3">
            <ol className="list-decimal space-y-2 pl-4 text-xs text-warmgrey">
              <li>
                Deploy your API on{" "}
                <a
                  href={RAILWAY_DASHBOARD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-semibold text-coral-deep hover:underline"
                >
                  Railway
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                and copy the public service URL.
              </li>
              <li>
                Create an API token at{" "}
                <a
                  href={RAILWAY_TOKENS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-semibold text-coral-deep hover:underline"
                >
                  Account tokens
                  <ExternalLink className="h-3 w-3" />
                </a>
                .
              </li>
            </ol>
            <label className="block text-xs font-semibold text-charcoal">
              Public service URL
              <input
                type="url"
                autoComplete="off"
                placeholder="https://your-api.up.railway.app"
                value={serviceUrl}
                onChange={(e) => setServiceUrl(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line/50 bg-white px-3 py-2.5 text-sm text-charcoal outline-none ring-coral/30 focus:ring-2"
              />
            </label>
            <label className="block text-xs font-semibold text-charcoal">
              Railway API token
              <input
                type="password"
                autoComplete="off"
                placeholder="Paste token"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line/50 bg-white px-3 py-2.5 text-sm text-charcoal outline-none ring-coral/30 focus:ring-2"
              />
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="button"
              disabled={
                apiToken.trim().length < 8 ||
                !/^https?:\/\/.+/i.test(serviceUrl.trim())
              }
              onClick={() => void connect()}
              className="w-full rounded-xl bg-[#0B0D0E] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Connect
            </button>
          </div>
        )}

        {step === "connecting" && (
          <div className="mt-8 flex flex-col items-center gap-2 py-6 text-sm text-warmgrey">
            <Loader2 className="h-6 w-6 animate-spin text-charcoal" />
            Validating token…
          </div>
        )}

        {step === "done" && result && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-moss/30 bg-moss/10 px-3 py-2 text-sm">
              <p className="font-semibold text-charcoal">Connected</p>
              <p className="mt-0.5 truncate text-xs text-warmgrey">{result.serviceUrl}</p>
            </div>
            <p className="text-xs text-warmgrey">
              Your app can call this URL for custom server logic. Ask Build to wire API calls when
              you&apos;re ready.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-xl bg-charcoal py-2.5 text-sm font-semibold text-cream"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
