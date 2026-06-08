"use client";

import { useState } from "react";
import { ExternalLink, Loader2, X } from "lucide-react";
import { connectRevenueCatToProject } from "@/server/connectors";
import type { RevenueCatConnectorPublic } from "@/lib/types";

const RC_KEYS_URL = "https://app.revenuecat.com/projects";

type Step = "keys" | "connecting" | "done";

export function RevenueCatConnectModal({
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
  onConnected: (connector: RevenueCatConnectorPublic) => void;
}) {
  const [step, setStep] = useState<Step>("keys");
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RevenueCatConnectorPublic | null>(null);

  if (!open) return null;

  function reset() {
    setStep("keys");
    setPublicKey("");
    setSecretKey("");
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
    const res = await connectRevenueCatToProject(projectId, publicKey, secretKey);
    if (!res.ok) {
      setError(res.message);
      setStep("keys");
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
      aria-labelledby="rc-connect-title"
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

        <h2 id="rc-connect-title" className="pr-8 text-lg font-bold text-charcoal">
          Connect RevenueCat
        </h2>
        <p className="mt-1 text-sm text-warmgrey">
          Subscriptions & paywalls for <span className="font-semibold text-charcoal">{appName}</span>
          . Webhooks sync entitlements to your linked Supabase.
        </p>

        {step === "keys" && (
          <div className="mt-4 space-y-3">
            <ol className="list-decimal space-y-2 pl-4 text-xs text-warmgrey">
              <li>
                Open{" "}
                <a
                  href={RC_KEYS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-semibold text-coral-deep hover:underline"
                >
                  RevenueCat dashboard
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                → your project → <span className="font-semibold text-charcoal">API keys</span>.
              </li>
              <li>
                Copy the <span className="font-semibold text-charcoal">Public API key</span> (for the
                app SDK) and the <span className="font-semibold text-charcoal">Secret API key</span>{" "}
                (server + webhooks).
              </li>
            </ol>
            <label className="block text-xs font-semibold text-charcoal">
              Public API key
              <input
                type="password"
                autoComplete="off"
                placeholder="appl_… or goog_…"
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line/50 bg-white px-3 py-2.5 text-sm text-charcoal outline-none ring-coral/30 focus:ring-2"
              />
            </label>
            <label className="block text-xs font-semibold text-charcoal">
              Secret API key
              <input
                type="password"
                autoComplete="off"
                placeholder="sk_…"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line/50 bg-white px-3 py-2.5 text-sm text-charcoal outline-none ring-coral/30 focus:ring-2"
              />
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="button"
              disabled={publicKey.trim().length < 8 || secretKey.trim().length < 8}
              onClick={() => void connect()}
              className="w-full rounded-xl bg-coral py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Connect
            </button>
          </div>
        )}

        {step === "connecting" && (
          <div className="mt-8 flex flex-col items-center gap-2 py-6 text-sm text-warmgrey">
            <Loader2 className="h-6 w-6 animate-spin text-coral" />
            Validating keys…
          </div>
        )}

        {step === "done" && result && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-moss/30 bg-moss/10 px-3 py-2 text-sm">
              <p className="font-semibold text-charcoal">Connected</p>
              <p className="mt-0.5 text-xs text-warmgrey">
                Key {result.publicApiKeyHint} · webhook ready to paste in RevenueCat
              </p>
            </div>
            <p className="text-xs text-warmgrey">
              Next: copy the webhook URL from Connections — RevenueCat will update{" "}
              <code className="text-charcoal">appable_subscriptions</code> in Supabase when users
              subscribe.
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
