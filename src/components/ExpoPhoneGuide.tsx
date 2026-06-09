"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  QrCode,
  Rocket,
  Smartphone,
} from "lucide-react";
import { buildExpoGoDeepLink } from "@/lib/expoGoLink";
import { cn } from "@/lib/utils";

const EXPO_IOS = "https://apps.apple.com/app/expo-go/id982107779";
const EXPO_ANDROID =
  "https://play.google.com/store/apps/details?id=host.exp.exponent";

type ExpoStatus = "idle" | "starting" | "ready" | "error";

function StepCard({
  step,
  title,
  hint,
  icon,
  children,
  accent,
}: {
  step: number;
  title: string;
  hint?: string;
  icon: ReactNode;
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-white/80 shadow-sm",
        accent
          ? "border-coral/25 bg-gradient-to-br from-coral/[0.05] via-white to-white shadow-[0_4px_16px_-8px_rgba(255,122,99,0.1)]"
          : "border-line/35"
      )}
    >
      {accent && (
        <span className="absolute inset-y-0 left-0 w-[3px] bg-coral" aria-hidden />
      )}
      <div className={cn("p-3", accent && "pl-4")}>
        <div className="mb-3 flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-coral/10 text-coral ring-1 ring-coral/20">
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-tight text-charcoal">
              <span className="text-warmgrey/80">{step}.</span> {title}
            </p>
            {hint && (
              <p className="mt-0.5 text-[10px] leading-relaxed text-warmgrey">
                {hint}
              </p>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function StoreButtons() {
  const btn =
    "inline-flex flex-1 items-center justify-center rounded-xl border border-line/40 bg-white py-2.5 text-[10px] font-semibold text-charcoal shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:border-line/60 hover:bg-sand/40";

  return (
    <div className="flex gap-2">
      <a href={EXPO_IOS} target="_blank" rel="noopener noreferrer" className={btn}>
        App Store
      </a>
      <a href={EXPO_ANDROID} target="_blank" rel="noopener noreferrer" className={btn}>
        Google Play
      </a>
    </div>
  );
}

export function ExpoPhoneGuide({
  projectId,
  previewToken,
  appName,
  ready,
  compact = false,
  embedded = false,
}: {
  projectId: string;
  previewToken: string | null;
  appName: string;
  ready: boolean;
  compact?: boolean;
  embedded?: boolean;
}) {
  const [status, setStatus] = useState<ExpoStatus>("idle");
  const [expoGoUrl, setExpoGoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !previewToken) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/expo/status", { cache: "no-store" });
        const data = (await res.json()) as {
          status: ExpoStatus;
          url?: string | null;
          error?: string;
        };
        if (cancelled) return;
        setStatus(data.status);
        if (data.error) setError(data.error);
        if (data.url && previewToken) {
          setExpoGoUrl(buildExpoGoDeepLink(data.url, projectId, previewToken));
        }
        if (data.status !== "ready" && data.status !== "error") {
          await fetch("/api/expo/start", { method: "POST" });
        }
      } catch {
        if (!cancelled) setError("Could not reach phone preview service");
      }
    }

    void fetch("/api/expo/start", { method: "POST" }).then(() => poll());
    const iv = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [ready, previewToken, projectId]);

  const qrSize = compact || embedded ? 188 : 220;
  const qrSrc =
    ready && expoGoUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&margin=8&data=${encodeURIComponent(expoGoUrl)}`
      : null;
  const qrReady = ready && status === "ready" && !!qrSrc;

  return (
    <aside
      className={cn(
        "flex flex-col",
        !embedded && (compact ? "p-4" : "h-full min-h-0 p-5"),
        embedded && "space-y-3"
      )}
    >
      {!embedded && (
        <header className={compact ? "mb-4" : "mb-5"}>
          <p
            className={cn(
              "font-semibold tracking-tight text-charcoal",
              compact ? "text-sm" : "text-base"
            )}
          >
            Preview on your phone
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-warmgrey">
            Test on a real device for touch, gestures, and native feel.
          </p>
        </header>
      )}

      <div
        className={cn(
          "space-y-3",
          !embedded && !compact && "min-h-0 flex-1 overflow-y-auto"
        )}
      >
        <StepCard
          step={1}
          title="Download Expo Go"
          hint="Free on the App Store or Google Play."
          icon={<Smartphone className="h-4 w-4" />}
        >
          <StoreButtons />
        </StepCard>

        <StepCard
          step={2}
          title="Scan the QR code"
          hint="Open Expo Go, tap Scan QR code, and point at your screen."
          icon={<QrCode className="h-4 w-4" />}
          accent={qrReady}
        >
          {!ready ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-line/40 bg-white/50 px-4 py-10 text-center">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-line/30 text-warmgrey/60 ring-1 ring-line/40">
                <QrCode className="h-5 w-5" />
              </span>
              <p className="mt-3 text-[10px] leading-relaxed text-warmgrey">
                Build your app first. Your QR code shows up here when it&apos;s ready.
              </p>
            </div>
          ) : status !== "ready" || !qrSrc ? (
            <div className="flex flex-col items-center rounded-xl border border-line/30 bg-gradient-to-br from-white to-sand/30 px-4 py-9 text-center">
              {status === "error" ? (
                <>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-coral/10 text-coral ring-1 ring-coral/20">
                    <Smartphone className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-[11px] font-semibold text-charcoal">
                    Phone preview didn&apos;t start
                  </p>
                  <p className="mt-1 text-[10px] text-warmgrey">
                    {error ?? "Try refreshing the page."}
                  </p>
                </>
              ) : (
                <>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-coral/10 text-coral ring-1 ring-coral/20">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </span>
                  <p className="mt-3 text-[11px] font-semibold text-charcoal">
                    Getting your phone preview ready…
                  </p>
                  <p className="mt-1 text-[10px] text-warmgrey">
                    First time can take a minute. We handle the setup.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line/25 bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <div className="mx-auto w-fit rounded-lg bg-white p-2 ring-1 ring-line/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrSrc}
                  alt={`QR code to open ${appName} in Expo Go`}
                  width={qrSize}
                  height={qrSize}
                  className="block rounded-md"
                />
              </div>
              <p className="mt-2.5 text-center text-[9px] font-medium text-warmgrey">
                Scan with Expo Go to open <span className="text-charcoal">{appName}</span>
              </p>
            </div>
          )}
        </StepCard>

        {ready && (
          <p className="rounded-xl border border-line/25 bg-white/60 px-3 py-2.5 text-[10px] leading-relaxed text-warmgrey">
            If Expo Go doesn&apos;t open after scanning, force-close the app and try again.
            Shake your phone in Expo Go and tap{" "}
            <span className="font-semibold text-charcoal">Reload</span> after you change
            something in the builder.
          </p>
        )}

        {ready && (
          <Link
            href={`/project/${projectId}`}
            className="group relative block overflow-hidden rounded-xl border border-line/25 bg-gradient-to-br from-white to-sand/40 p-3 shadow-[0_2px_12px_-6px_rgba(43,38,36,0.08)] transition hover:border-line/40 hover:shadow-[0_4px_16px_-8px_rgba(43,38,36,0.1)]"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-coral/10 text-coral ring-1 ring-coral/20">
                <Rocket className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold tracking-tight text-charcoal">
                  Ready to publish to the App Store?
                </span>
                <span className="mt-0.5 block text-[10px] leading-relaxed text-warmgrey">
                  Screenshots, store copy, and submission help when you&apos;re ready to ship.
                </span>
              </span>
            </div>
            <span className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-charcoal px-3 py-2.5 text-[10px] font-semibold text-white shadow-[0_4px_14px_-6px_rgba(43,38,36,0.45)] transition group-hover:brightness-110">
              Launch
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        )}
      </div>
    </aside>
  );
}
