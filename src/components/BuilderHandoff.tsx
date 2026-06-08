"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Smartphone,
  Apple,
  Sparkles,
  MonitorDown,
  Download,
  Loader2,
  Check,
} from "lucide-react";
import { openInBuilder } from "@/server/projects";
import type { BuildTarget } from "@/lib/types";

/**
 * Post-interview handoff: pick a build target and open the Builder via a
 * one-time deep link (no manual project ID). Device-aware — on mobile the Swift
 * path is framed aspirationally ("continue on your computer"), never as a wall.
 */
export function BuilderHandoff({
  projectId,
  appName,
  isMobile,
  initialTarget,
}: {
  projectId: string;
  appName: string;
  isMobile: boolean;
  initialTarget: BuildTarget | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<BuildTarget | null>(null);
  const [opened, setOpened] = useState<BuildTarget | null>(initialTarget);
  const [fallback, setFallback] = useState<string | null>(null);

  async function choose(target: BuildTarget) {
    if (busy) return;

    // RN / Expo stays on the web — instant chat build room + phone preview.
    if (target === "rn") {
      router.push(`/project/${projectId}/expo`);
      return;
    }

    setBusy(target);
    try {
      const res = await openInBuilder(projectId, target);
      setOpened(target);
      setFallback(res.fallbackUrl);
      if (!isMobile) {
        window.location.href = res.deepLink;
      }
    } catch {
      /* surfaced via the fallback link below */
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Option 1 — Build here (React Native + Expo) */}
        <TargetCard
          icon={Smartphone}
          title="Build here"
          tag="React Native"
          recommended={false}
          highlight={isMobile}
          desc="Stays right here on the web. Confirm your plan, then scan the QR in Expo Go to run it on your phone."
          cta={isMobile ? "Build on my phone" : "Build with Expo"}
          busy={busy === "rn"}
          done={opened === "rn"}
          onClick={() => void choose("rn")}
        />

        {/* Option 2 — Appable App Builder (Swift native) */}
        <TargetCard
          icon={Apple}
          title="Appable App Builder"
          tag="Swift native"
          recommended
          highlight={!isMobile}
          desc={
            isMobile
              ? "Real native iOS app. Log in on your computer with this same account to continue — your app is saved and waiting."
              : "Real native SwiftUI app — the App Store-quality path. Opens in the Appable Builder on your computer."
          }
          cta={isMobile ? "Continue on computer" : "Open Appable Builder"}
          mobileLocked={isMobile}
          busy={busy === "swift"}
          done={opened === "swift"}
          onClick={() => void choose("swift")}
        />
      </div>

      {opened && fallback && (
        <div className="rounded-xl border border-line/60 bg-cream/70 p-3 text-xs text-charcoal-soft">
          {opened === "swift" && !isMobile ? (
            <p className="flex items-center gap-2">
              <MonitorDown className="h-3.5 w-3.5 text-coral" />
              <span>
                Builder should be opening. Don&apos;t have it yet?{" "}
                <button
                  type="button"
                  disabled
                  className="font-semibold text-coral-deep underline decoration-dotted"
                >
                  Download Appable Builder
                </button>
                .
              </span>
            </p>
          ) : opened === "swift" && isMobile ? (
            <p>
              Saved to your account as <strong>{appName}</strong>. Open
              getappable.com on your computer and it&apos;ll be right here.
            </p>
          ) : (
            <p>
              Opening <strong>{appName}</strong> in the Builder. It&apos;ll pull
              your plan and start the Expo preview.
            </p>
          )}
          <a
            href={`/api/projects/${projectId}/export`}
            className="mt-2 inline-flex items-center gap-1.5 font-semibold text-charcoal hover:text-coral-deep"
          >
            <Download className="h-3.5 w-3.5" />
            Export your code
          </a>
        </div>
      )}
    </div>
  );
}

function TargetCard({
  icon: Icon,
  title,
  tag,
  desc,
  cta,
  recommended,
  highlight,
  mobileLocked,
  busy,
  done,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tag: string;
  desc: string;
  cta: string;
  recommended: boolean;
  highlight: boolean;
  mobileLocked?: boolean;
  busy: boolean;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-4 shadow-soft transition ${
        highlight
          ? "border-coral/50 bg-coral/[0.04]"
          : "border-line/60 bg-white/70"
      }`}
    >
      {recommended && (
        <span className="absolute -top-2 right-3 inline-flex items-center gap-1 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-soft">
          <Sparkles className="h-3 w-3" />
          Highly recommended
        </span>
      )}
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-sand text-coral">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          <p className="text-[11px] font-medium uppercase tracking-wide text-warmgrey">
            {tag}
          </p>
        </div>
      </div>
      <p className="flex-1 text-xs leading-relaxed text-charcoal-soft">{desc}</p>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
          mobileLocked
            ? "border border-coral/30 bg-coral/8 text-coral-deep hover:bg-coral/12"
            : "bg-coral text-white hover:bg-coral-deep"
        }`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : done ? (
          <Check className="h-4 w-4" />
        ) : null}
        {busy ? "Preparing…" : cta}
      </button>
    </div>
  );
}
