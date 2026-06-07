"use client";

import { useMemo } from "react";
import { ExternalLink, QrCode, Smartphone } from "lucide-react";

const EXPO_IOS =
  "https://apps.apple.com/app/expo-go/id982107779";
const EXPO_ANDROID =
  "https://play.google.com/store/apps/details?id=host.exp.exponent";

export function ExpoPhoneGuide({
  projectId,
  appName,
  ready,
}: {
  projectId: string;
  appName: string;
  ready: boolean;
}) {
  const previewUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/project/${projectId}/expo/preview`;
  }, [projectId]);

  const qrSrc =
    previewUrl && ready
      ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(previewUrl)}`
      : null;

  return (
    <aside className="card-float flex h-full min-h-0 flex-col overflow-hidden p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-charcoal/5 text-charcoal">
          <Smartphone className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Try on your phone</p>
          <p className="text-[11px] text-warmgrey">Same preview, real device</p>
        </div>
      </div>

      <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto text-sm">
        <li className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-warmgrey">
            1 · Install Expo Go
          </p>
          <p className="text-xs leading-relaxed text-charcoal-soft">
            Free app from the store — you&apos;ll use it to open {appName} on your
            phone.
          </p>
          <div className="flex flex-col gap-1.5">
            <a
              href={EXPO_IOS}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line/70 bg-white px-3 py-2 text-xs font-semibold text-charcoal transition hover:border-coral/40"
            >
              App Store
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
            <a
              href={EXPO_ANDROID}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line/70 bg-white px-3 py-2 text-xs font-semibold text-charcoal transition hover:border-coral/40"
            >
              Google Play
              <ExternalLink className="h-3 w-3 opacity-50" />
            </a>
          </div>
        </li>

        <li className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-warmgrey">
            2 · Scan on your phone
          </p>
          {ready && qrSrc ? (
            <>
              <div className="mx-auto w-fit rounded-xl border border-line/60 bg-white p-2 shadow-soft">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrSrc}
                  alt={`QR code to open ${appName} preview`}
                  width={180}
                  height={180}
                  className="block rounded-lg"
                />
              </div>
              <p className="text-center text-[11px] text-warmgrey">
                Point your camera or Expo Go at the code
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-line/70 bg-cream/40 px-3 py-6 text-center">
              <QrCode className="h-8 w-8 text-warmgrey/50" />
              <p className="mt-2 text-xs text-warmgrey">
                QR appears when your preview is ready
              </p>
            </div>
          )}
        </li>

        <li className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-warmgrey">
            3 · Open in Expo Go
          </p>
          <p className="text-xs leading-relaxed text-charcoal-soft">
            {ready ? (
              <>
                Opens your live preview in the browser on your phone. You can also
                paste this link in Expo Go when we hook up the native bundle:
              </>
            ) : (
              <>Confirm and build first — then scan to open on your device.</>
            )}
          </p>
          {ready && previewUrl ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block break-all rounded-lg bg-cream/80 px-2.5 py-2 text-[11px] font-medium text-coral-deep hover:underline"
            >
              {previewUrl.replace(/^https?:\/\//, "")}
            </a>
          ) : null}
        </li>
      </ol>
    </aside>
  );
}
