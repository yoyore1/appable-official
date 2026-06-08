"use client";

import { useState } from "react";
import { ExternalLink, Loader2, X } from "lucide-react";
import {
  connectSupabaseToProject,
  listSupabaseProjectsForConnect,
  type SupabaseProjectOption,
} from "@/server/connectors";
import type { SupabaseConnectorPublic } from "@/lib/types";
import { cn } from "@/lib/utils";

const TOKEN_URL = "https://supabase.com/dashboard/account/tokens";

type Step = "token" | "pick" | "connecting" | "done";

export function SupabaseConnectModal({
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
  onConnected: (connector: SupabaseConnectorPublic) => void;
}) {
  const [step, setStep] = useState<Step>("token");
  const [token, setToken] = useState("");
  const [projects, setProjects] = useState<SupabaseProjectOption[]>([]);
  const [selected, setSelected] = useState<SupabaseProjectOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SupabaseConnectorPublic | null>(null);

  if (!open) return null;

  function reset() {
    setStep("token");
    setToken("");
    setProjects([]);
    setSelected(null);
    setError(null);
    setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function loadProjects() {
    setError(null);
    setStep("pick");
    const res = await listSupabaseProjectsForConnect(projectId, token);
    if (!res.ok) {
      setError(res.message);
      setStep("token");
      return;
    }
    if (res.projects.length === 0) {
      setError("No projects found — create one in Supabase first, then try again.");
      setStep("token");
      return;
    }
    setProjects(res.projects);
    if (res.projects.length === 1) setSelected(res.projects[0]);
  }

  async function confirmConnect() {
    if (!selected) return;
    setError(null);
    setStep("connecting");
    const res = await connectSupabaseToProject(
      projectId,
      token,
      selected.ref,
      selected.name,
      selected.region
    );
    if (!res.ok) {
      setError(res.message);
      setStep("pick");
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
      aria-labelledby="supabase-connect-title"
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

        <h2 id="supabase-connect-title" className="pr-8 text-lg font-bold text-charcoal">
          Connect Supabase
        </h2>
        <p className="mt-1 text-sm text-warmgrey">
          Link <span className="font-semibold text-charcoal">{appName}</span> to your Supabase
          project — no API keys to copy into chat.
        </p>

        {step === "token" && (
          <div className="mt-4 space-y-3">
            <ol className="list-decimal space-y-2 pl-4 text-xs text-warmgrey">
              <li>
                Open{" "}
                <a
                  href={TOKEN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-semibold text-coral-deep hover:underline"
                >
                  Supabase access tokens
                  <ExternalLink className="h-3 w-3" />
                </a>{" "}
                and click <span className="font-semibold text-charcoal">Generate new token</span>.
              </li>
              <li>
                On the form, fill in:
                <ul className="mt-1.5 space-y-1 rounded-lg border border-line/35 bg-white/90 p-2.5 text-[11px]">
                  <li>
                    <span className="font-semibold text-charcoal">Name</span> —{" "}
                    <code className="text-charcoal">appable</code> (or anything you&apos;ll
                    recognize)
                  </li>
                  <li>
                    <span className="font-semibold text-charcoal">Expires in</span> —{" "}
                    <span className="font-semibold text-charcoal">30 days</span> is fine. We use
                    this token once to connect, then{" "}
                    <span className="text-charcoal">we don&apos;t store it</span>. Your app stays
                    linked after that. If you disconnect or need to retry setup later, generate a
                    fresh token when the old one has expired.
                  </li>
                </ul>
              </li>
              <li>
                Supabase will warn that tokens control your whole account — only paste it here on
                Appable, never in chat or email.
              </li>
              <li>Copy the token (shown once) and paste it below.</li>
            </ol>
            <input
              type="password"
              autoComplete="off"
              placeholder="sbp_…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-xl border border-line/50 bg-white px-3 py-2.5 text-sm text-charcoal outline-none ring-coral/30 focus:ring-2"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="button"
              disabled={token.trim().length < 8}
              onClick={() => void loadProjects()}
              className="w-full rounded-xl bg-coral py-2.5 text-sm font-semibold text-white transition hover:bg-coral-deep disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {step === "pick" && (
          <div className="mt-4 space-y-3">
            <p className="text-xs font-semibold text-charcoal">Which project is for this app?</p>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {projects.map((p) => (
                <button
                  key={p.ref}
                  type="button"
                  onClick={() => setSelected(p)}
                  className={cn(
                    "flex w-full flex-col rounded-xl border px-3 py-2 text-left text-sm transition",
                    selected?.ref === p.ref
                      ? "border-coral/50 bg-coral/10"
                      : "border-line/40 bg-white hover:border-line"
                  )}
                >
                  <span className="font-semibold text-charcoal">{p.name}</span>
                  <span className="text-[10px] text-warmgrey">
                    {p.ref}
                    {p.region ? ` · ${p.region}` : ""}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-warmgrey">
              We&apos;ll add an <code className="text-charcoal">appable_profiles</code> table with{" "}
              <code className="text-charcoal">has_completed_onboarding</code> — not your other
              tables.
            </p>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("token")}
                className="flex-1 rounded-xl border border-line/50 py-2 text-sm font-semibold text-warmgrey"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!selected}
                onClick={() => void confirmConnect()}
                className="flex-1 rounded-xl bg-coral py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Connect
              </button>
            </div>
          </div>
        )}

        {step === "connecting" && (
          <div className="mt-8 flex flex-col items-center gap-2 py-6 text-sm text-warmgrey">
            <Loader2 className="h-6 w-6 animate-spin text-coral" />
            Linking project and setting up tables…
          </div>
        )}

        {step === "done" && result && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-moss/30 bg-moss/10 px-3 py-2 text-sm">
              <p className="font-semibold text-charcoal">
                {result.status === "connected" ? "Connected" : "Linked with setup warning"}
              </p>
              <p className="mt-0.5 text-xs text-warmgrey">
                {result.projectName} · {result.url}
              </p>
              {result.setupError && (
                <p className="mt-2 text-xs text-amber-800">{result.setupError}</p>
              )}
            </div>
            <p className="text-xs text-warmgrey">
              Next: <span className="font-semibold text-charcoal">Build</span> → wire sign-up (Google,
              Apple, and email). Before App Store launch, enable Google &amp; Apple under Supabase →
              Authentication → Providers.
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
