import Link from "next/link";
import { MonitorDown } from "lucide-react";
import { Background } from "@/components/Background";
import { builderProtocol, appUrl } from "@/lib/config";

/**
 * Web fallback for the Builder deep link. Shown if the `appable://` protocol
 * isn't registered yet (Builder not installed). Offers the download + a retry.
 */
export default function HandoffFallbackPage({
  params,
}: {
  params: { token: string };
}) {
  const deepLink = `${builderProtocol}://handoff?token=${params.token}&api=${appUrl}`;

  return (
    <>
      <Background calm />
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-coral text-xl font-bold text-white shadow-soft">
          A
        </span>
        <h1 className="mt-4 text-2xl font-bold">Opening Appable Builder…</h1>
        <p className="mt-2 text-sm text-charcoal-soft">
          If it didn&apos;t open, you may not have the Builder installed yet.
          Install it, then come back and tap below — your app is saved.
        </p>

        <a href={deepLink} className="btn-primary mt-5 w-full">
          Open Appable Builder
        </a>
        <button
          type="button"
          disabled
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-coral/30 bg-coral/8 px-4 py-3 text-sm font-semibold text-coral-deep"
        >
          <MonitorDown className="h-4 w-4" />
          Download Appable Builder
        </button>

        <Link href="/dashboard" className="mt-4 text-xs text-warmgrey hover:text-charcoal">
          ← Back to dashboard
        </Link>
      </main>
    </>
  );
}
