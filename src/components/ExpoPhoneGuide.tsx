"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, QrCode, Rocket, Smartphone } from "lucide-react";
import { buildExpoGoDeepLink } from "@/lib/expoGoLink";
import { cn } from "@/lib/utils";

const EXPO_IOS = "https://apps.apple.com/app/expo-go/id982107779";
const EXPO_ANDROID =
  "https://play.google.com/store/apps/details?id=host.exp.exponent";

type ExpoStatus = "idle" | "starting" | "ready" | "error";

function StepHeading({
  n,
  title,
  hint,
}: {
  n: number;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-2.5">
      <p className="text-sm font-semibold text-charcoal">
        {n}. {title}
      </p>
      {hint && <p className="mt-0.5 text-xs leading-snug text-warmgrey">{hint}</p>}
    </div>
  );
}

function StoreButtons({ compact }: { compact?: boolean }) {
  const btn =
    "inline-flex flex-1 items-center justify-center rounded-lg border border-line/60 bg-white px-3 py-2 text-xs font-semibold text-charcoal shadow-[0_1px_2px_rgba(43,38,36,0.04)] transition hover:border-charcoal/25 hover:bg-cream/40";

  return (
    <div className={cn("flex gap-2", compact && "gap-1.5")}>
      <a href={EXPO_IOS} target="_blank" rel="noopener noreferrer" className={btn}>
        iOS
      </a>
      <a href={EXPO_ANDROID} target="_blank" rel="noopener noreferrer" className={btn}>
        Android
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

  const qrSize = compact || embedded ? 200 : 240;
  const qrSrc =
    ready && expoGoUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&margin=8&data=${encodeURIComponent(expoGoUrl)}`
      : null;

  return (
    <aside
      className={cn(
        "flex flex-col",
        !embedded && (compact ? "p-4" : "h-full min-h-0 p-5")
      )}
    >
      {!embedded && (
        <header className={compact ? "mb-4" : "mb-6"}>
          <p className={cn("font-semibold text-charcoal", compact ? "text-sm" : "text-base")}>
            Preview on your phone
          </p>
          <p className="mt-1 text-xs leading-relaxed text-warmgrey">
            Test on a mobile device to experience touch gestures and native features.
          </p>
        </header>
      )}

      <div
        className={cn(
          "space-y-5",
          !embedded && !compact && "min-h-0 flex-1 overflow-y-auto"
        )}
      >
        <section>
          <StepHeading
            n={1}
            title="Download Expo Go"
            hint="Get the free app on your phone first."
          />
          <StoreButtons compact={compact || embedded} />
        </section>

        <section>
          <StepHeading
            n={2}
            title="Scan the QR code"
            hint="Open Expo Go → tap Scan QR code → point at this screen."
          />

          {!ready ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-line/55 bg-cream/25 px-4 py-12 text-center">
              <QrCode className="h-9 w-9 text-warmgrey/35" />
              <p className="mt-3 text-xs text-warmgrey">
                Build your app first — your QR code will appear here.
              </p>
            </div>
          ) : status !== "ready" || !qrSrc ? (
            <div className="flex flex-col items-center rounded-2xl border border-line/45 bg-white px-4 py-10 text-center shadow-[0_2px_16px_-8px_rgba(43,38,36,0.12)]">
              {status === "error" ? (
                <>
                  <Smartphone className="h-9 w-9 text-coral/55" />
                  <p className="mt-3 text-sm font-medium text-charcoal">
                    Phone preview didn&apos;t start
                  </p>
                  <p className="mt-1 text-xs text-warmgrey">
                    {error ?? "Try refreshing the page."}
                  </p>
                </>
              ) : (
                <>
                  <Loader2 className="h-9 w-9 animate-spin text-coral" />
                  <p className="mt-3 text-sm font-medium text-charcoal">
                    Getting your phone preview ready…
                  </p>
                  <p className="mt-1 text-xs text-warmgrey">
                    First time can take a minute — we handle the setup.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line/40 bg-white p-4 shadow-[0_2px_20px_-8px_rgba(43,38,36,0.14)]">
              <div className="mx-auto w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrSrc}
                  alt={`QR code to open ${appName} in Expo Go`}
                  width={qrSize}
                  height={qrSize}
                  className="block rounded-lg"
                />
              </div>
            </div>
          )}
        </section>

        {ready && (
          <div className="rounded-xl border border-line/35 bg-sand/40 px-3.5 py-3 text-[11px] leading-relaxed text-charcoal-soft">
            If Expo Go doesn&apos;t open after scanning, force-close the app and try again.
            Shake your phone in Expo Go and tap <span className="font-medium text-charcoal">Reload</span>{" "}
            after you change something in the builder.
          </div>
        )}

        {ready && (
          <Link
            href={`/project/${projectId}`}
            className="group block rounded-2xl border border-coral/25 bg-gradient-to-br from-coral/[0.12] via-peach/20 to-cream/60 p-4 transition hover:border-coral/40 hover:shadow-[0_4px_20px_-8px_rgba(255,122,99,0.25)]"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/80 text-coral shadow-sm ring-1 ring-coral/15">
                <Rocket className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-charcoal">
                  Ready to publish to the App Store?
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-warmgrey">
                  Screenshots, ASO copy, and submission help when you&apos;re ready to ship.
                </span>
              </span>
            </div>
            <span className="mt-3 inline-flex items-center gap-1 rounded-lg bg-charcoal px-3 py-1.5 text-xs font-semibold text-white transition group-hover:bg-charcoal/90">
              Launch
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        )}
      </div>
    </aside>
  );
}
