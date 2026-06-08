"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { CopyableValue } from "@/components/CopyableValue";
import { AppleLogo, GoogleLogo } from "@/components/OAuthBrandIcons";
import {
  appleSetupSteps,
  googleSetupSteps,
  OAUTH_EXPECTATIONS,
  type OAuthProvider,
  type OAuthSetupStep,
} from "@/lib/expoApp/oauthSetupSteps";
import type { SupabaseConnectorPublic } from "@/lib/types";
import { cn } from "@/lib/utils";

function StepList({ steps }: { steps: OAuthSetupStep[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={step.title} className="rounded-lg border border-line/30 bg-cream/50 p-2.5">
          <p className="text-[10px] font-bold text-charcoal">
            {i + 1}. {step.title}
          </p>
          <p className="mt-0.5 text-[9px] leading-snug text-warmgrey">{step.body}</p>
          {step.copyValue && step.copyLabel && (
            <div className="mt-2">
              <CopyableValue label={step.copyLabel} value={step.copyValue} />
            </div>
          )}
          {(step.href || step.href2) && (
            <div className="mt-2 flex flex-col gap-1">
              {step.href && (
                <a
                  href={step.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[9px] font-semibold text-coral-deep hover:underline"
                >
                  {step.hrefLabel ?? "Open link"}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {step.href2 && (
                <a
                  href={step.href2}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[9px] font-semibold text-coral-deep hover:underline"
                >
                  {step.href2Label ?? "More help"}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function ProviderSection({
  provider,
  title,
  subtitle,
  steps,
  defaultOpen,
}: {
  provider: OAuthProvider;
  title: string;
  subtitle: string;
  steps: OAuthSetupStep[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="rounded-xl border border-line/35 bg-white/80">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
        aria-expanded={open}
      >
        <span
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
            provider === "google" ? "bg-white ring-1 ring-line/30" : "bg-black"
          )}
        >
          {provider === "google" ? (
            <GoogleLogo className="h-4 w-4" />
          ) : (
            <AppleLogo className="h-4 w-4" fill="#fff" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold text-charcoal">{title}</span>
          <span className="block text-[9px] text-warmgrey">{subtitle}</span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-warmgrey transition", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="border-t border-line/25 px-2.5 pb-2.5 pt-1">
          <StepList steps={steps} />
        </div>
      )}
    </div>
  );
}

export function OAuthSetupGuide({
  connector,
  compact = false,
}: {
  connector: SupabaseConnectorPublic;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-2", compact ? "" : "mt-2")}>
      <div className="rounded-lg border border-coral/20 bg-coral/[0.06] px-2.5 py-2">
        <p className="text-[9px] font-semibold text-charcoal">Before you start</p>
        <p className="mt-0.5 text-[9px] leading-snug text-warmgrey">{OAUTH_EXPECTATIONS}</p>
      </div>
      <ProviderSection
        provider="google"
        title="Set up Google login"
        subtitle="~20 min · do this before beta testers"
        steps={googleSetupSteps(connector)}
      />
      <ProviderSection
        provider="apple"
        title="Set up Apple login"
        subtitle="Before App Store · needs $99/yr developer account"
        steps={appleSetupSteps(connector)}
      />
    </div>
  );
}
