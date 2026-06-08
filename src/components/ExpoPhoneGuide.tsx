"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, QrCode, Smartphone } from "lucide-react";
import { buildExpoGoDeepLink } from "@/lib/expoGoLink";

const EXPO_IOS = "https://apps.apple.com/app/expo-go/id982107779";
const EXPO_ANDROID =
  "https://play.google.com/store/apps/details?id=host.exp.exponent";

type ExpoStatus = "idle" | "starting" | "ready" | "error";

export function ExpoPhoneGuide({
  projectId,
  previewToken,
  appName,
  ready,
}: {
  projectId: string;
  previewToken: string | null;
  appName: string;
  ready: boolean;
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

  const qrSrc =
    ready && expoGoUrl
      ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(expoGoUrl)}`
      : null;

  return (
    <aside className="flex h-full min-h-0 flex-col p-5">
      <div className="mb-5">
        <p className="text-base font-semibold text-charcoal">Preview on your phone</p>
        <p className="mt-1 text-sm leading-relaxed text-charcoal-soft">
          Test on a real device — touch, scroll, and see {appName} like a real app.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto">
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-warmgrey">
            Step 1 · Download Expo Go
          </p>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={EXPO_IOS}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line/70 bg-cream/50 px-3 py-2.5 text-xs font-semibold text-charcoal transition hover:border-coral/40"
            >
              App Store
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
            <a
              href={EXPO_ANDROID}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line/70 bg-cream/50 px-3 py-2.5 text-xs font-semibold text-charcoal transition hover:border-coral/40"
            >
              Google Play
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-warmgrey">
            Step 2 · Scan the QR code
          </p>

          {!ready ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-line/70 bg-cream/30 px-4 py-10 text-center">
              <QrCode className="h-10 w-10 text-warmgrey/40" />
              <p className="mt-3 text-sm text-warmgrey">
                Build your app first — we&apos;ll put the code here.
              </p>
            </div>
          ) : status !== "ready" || !qrSrc ? (
            <div className="flex flex-col items-center rounded-2xl border border-line/60 bg-cream/40 px-4 py-10 text-center">
              {status === "error" ? (
                <>
                  <Smartphone className="h-10 w-10 text-coral/60" />
                  <p className="mt-3 text-sm font-medium text-charcoal">
                    Phone preview didn&apos;t start
                  </p>
                  <p className="mt-1 text-xs text-warmgrey">{error ?? "Try refreshing the page."}</p>
                </>
              ) : (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-coral" />
                  <p className="mt-3 text-sm font-medium text-charcoal">
                    Getting your phone preview ready…
                  </p>
                  <p className="mt-1 text-xs text-warmgrey">
                    First time can take a minute — we handle the setup for you.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="mx-auto w-fit rounded-2xl border border-line/60 bg-white p-3 shadow-float">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrSrc}
                  alt={`QR code to open ${appName} in Expo Go`}
                  width={220}
                  height={220}
                  className="block rounded-xl"
                />
              </div>
              <p className="text-center text-sm leading-relaxed text-charcoal-soft">
                Open <span className="font-semibold text-charcoal">Expo Go</span> → tap{" "}
                <span className="font-semibold text-charcoal">Scan QR code</span> → point at
                this screen.
              </p>
            </>
          )}
        </section>

        {ready && status === "ready" && (
          <section className="rounded-xl bg-moss/8 px-3.5 py-3 text-xs leading-relaxed text-charcoal-soft">
            <span className="font-semibold text-moss">Tip:</span> Shake your phone in Expo Go
            and tap Reload if you just changed something.
          </section>
        )}
      </div>
    </aside>
  );
}
