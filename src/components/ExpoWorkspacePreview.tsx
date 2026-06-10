"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Loader2, RefreshCw, Smartphone, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type PreviewCompilePhase = "idle" | "installing" | "exporting" | "ready" | "error";

interface Status {
  phase: PreviewCompilePhase;
  builtAt: string | null;
  error?: string;
  hasDist: boolean;
}

export type PreviewRuntimeStatus = Status;

export type PreviewStatusUpdate = PreviewRuntimeStatus & {
  compiling: boolean;
  justReady: boolean;
  /** True when the live Metro web dev server is backing the iframe (Fast Refresh). */
  live: boolean;
};

export interface TapPayload {
  kind: "text" | "box" | "screen";
  id: string;
  path?: string;
  text: string;
  color: string;
  background: string;
}

export interface WorkspacePreviewHandle {
  applyLive(msg: {
    id: string;
    kind: string;
    text?: string;
    color?: string;
    background?: string;
  }): void;
}

const PHONE_W = 300;
const PHONE_RATIO = 70.6 / 146.6;

const PHASE_LABEL: Record<PreviewCompilePhase, string> = {
  idle: "Preparing your app…",
  installing: "Installing dependencies (first build can take 2–4 min)…",
  exporting: "Updating preview in the background — give it a few minutes…",
  ready: "Live app",
  error: "Build hit a snag",
};

/** Renders the real workspace Expo app (web build) inside a phone frame. */
export const ExpoWorkspacePreview = forwardRef<
  WorkspacePreviewHandle,
  {
    projectId: string;
    appName: string;
    building?: boolean;
    buildPercent?: number;
    className?: string;
    showWatermark?: boolean;
    editMode?: boolean;
    onTap?: (payload: TapPayload) => void;
    onStatusChange?: (update: PreviewStatusUpdate) => void;
    /** True right after Build saves — keeps overlay until compile finishes. */
    awaitingUpdate?: boolean;
  }
>(function ExpoWorkspacePreview(
  {
    projectId,
    appName,
    building,
    buildPercent,
    className,
    showWatermark,
    editMode,
    onTap,
    onStatusChange,
    awaitingUpdate,
  },
  ref
) {
  const [status, setStatus] = useState<Status>({
    phase: "idle",
    builtAt: null,
    hasDist: false,
  });
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const lastBuiltAt = useRef<string | null>(null);
  const wasCompiling = useRef(false);
  const [justReady, setJustReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const postToIframe = useCallback((msg: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(
      { target: "appable", ...msg },
      "*"
    );
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      applyLive(msg) {
        postToIframe({ type: "appable:apply", ...msg });
      },
    }),
    [postToIframe]
  );

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const m = e.data as
        | { source?: string; type?: string }
        | undefined;
      if (!m || m.source !== "appable") return;
      if (m.type === "appable:ready") {
        postToIframe({ type: "appable:editMode", on: Boolean(editMode) });
      } else if (m.type === "appable:tap") {
        onTap?.(e.data as TapPayload);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [editMode, onTap, postToIframe]);

  useEffect(() => {
    postToIframe({ type: "appable:editMode", on: Boolean(editMode) });
  }, [editMode, iframeSrc, postToIframe]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/runtime`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const raw = (await res.json()) as {
        installing?: boolean;
        web?: Status;
        liveWeb?: { phase?: string; publicUrl?: string | null };
        health?: { healthy?: boolean };
      };
      const data: Status = raw.web ?? {
        phase: "idle",
        builtAt: null,
        hasDist: false,
      };
      if (raw.installing && data.phase === "idle") {
        data.phase = "installing";
      }
      if (
        data.phase === "error" &&
        (raw.installing || raw.health?.healthy === false)
      ) {
        data.error = "Auto-repairing your app environment…";
        data.phase = "installing";
      }
      setStatus(data);

      // Live Metro (proxied on this host) — stable src so Fast Refresh updates in place.
      const live = raw.liveWeb;
      if (live?.phase === "ready" && live.publicUrl) {
        const src = `${live.publicUrl}/`;
        setLiveUrl(src);
        if (iframeSrc !== src) {
          lastBuiltAt.current = data.builtAt;
          setIframeSrc(src);
        }
        return;
      }

      // Static export fallback (first paint while Metro warms up, and on dev-server error).
      if (data.hasDist && data.builtAt !== lastBuiltAt.current) {
        lastBuiltAt.current = data.builtAt;
        setIframeSrc(
          `/api/expo-web/${projectId}/?v=${encodeURIComponent(data.builtAt ?? "1")}`
        );
      } else if (data.hasDist && !iframeSrc) {
        setIframeSrc(`/api/expo-web/${projectId}/`);
      }
    } catch {
      /* keep last state */
    }
  }, [projectId, iframeSrc]);

  useEffect(() => {
    void poll();
    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => {
    if (status.phase !== "error") return;
    const retry = setInterval(() => {
      void fetch(`/api/projects/${projectId}/runtime?rebuild=1`, {
        method: "POST",
      }).catch(() => undefined);
    }, 8_000);
    return () => clearInterval(retry);
  }, [status.phase, projectId]);

  const kicked = useRef(false);
  useEffect(() => {
    if (kicked.current) return;
    kicked.current = true;
    void fetch(`/api/projects/${projectId}/runtime`, { method: "POST" }).catch(
      () => undefined
    );
  }, [projectId]);

  const retry = useCallback(async () => {
    try {
      setStatus((s) => ({ ...s, phase: "installing", error: undefined }));
      await fetch(`/api/projects/${projectId}/runtime?rebuild=1`, {
        method: "POST",
      });
      void poll();
    } catch {
      /* ignore */
    }
  }, [projectId, poll]);

  const haveLive = Boolean(liveUrl);

  // With the live dev server up, Fast Refresh applies edits in place — only a full
  // code-agent build (`building`) blocks the view. Without it we fall back to the
  // slower export phases, which do warrant the overlay.
  const compiling =
    building ||
    (!haveLive &&
      (awaitingUpdate ||
        status.phase === "installing" ||
        status.phase === "exporting" ||
        (status.phase === "idle" && !status.hasDist)));

  useEffect(() => {
    onStatusChange?.({ ...status, compiling, justReady, live: haveLive });
  }, [status, compiling, justReady, haveLive, onStatusChange]);

  useEffect(() => {
    if (compiling) {
      wasCompiling.current = true;
      setJustReady(false);
      return;
    }
    if (wasCompiling.current && status.phase === "ready" && status.hasDist) {
      wasCompiling.current = false;
      setJustReady(true);
      const t = setTimeout(() => setJustReady(false), 8000);
      return () => clearTimeout(t);
    }
  }, [compiling, status.phase, status.hasDist]);

  const showIframe = Boolean(iframeSrc) && (haveLive || status.hasDist);

  const statusLine = compiling
    ? status.phase === "installing"
      ? "Installing — first build can take a few minutes…"
      : awaitingUpdate && status.phase === "ready"
        ? "Applying your change — still working, not crashed…"
        : "Updating preview in the background…"
    : haveLive && awaitingUpdate
      ? "Applying your change — live refresh…"
      : justReady
        ? "Preview updated — you're live"
        : haveLive
          ? "Live preview — instant refresh"
          : status.phase === "ready" && status.hasDist
            ? "Preview live"
            : status.phase === "error"
              ? "Preview needs a rebuild"
              : null;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: PHONE_W, maxWidth: "min(300px, 78vw)" }}
    >
      <div
        className="relative overflow-hidden rounded-[2.4rem] border-[10px] border-charcoal bg-charcoal shadow-[0_24px_60px_-24px_rgba(43,38,36,0.6)]"
        style={{ aspectRatio: `${PHONE_RATIO}` }}
      >
        <span className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-charcoal" aria-hidden />

        {showIframe && (
          <iframe
            ref={iframeRef}
            key={iframeSrc ?? "live"}
            src={iframeSrc ?? undefined}
            title={`${appName} live preview`}
            className="absolute inset-0 h-full w-full rounded-[1.7rem] bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}

        {compiling && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[1.7rem] bg-cream/95 px-6 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-coral" />
            <p className="text-xs font-semibold text-charcoal">
              {awaitingUpdate && !building
                ? "Updating your phone preview"
                : (
                  <>
                    Building <span className="text-coral">{appName}</span>
                  </>
                )}
            </p>
            <p className="text-[11px] leading-relaxed text-warmgrey">
              {building && typeof buildPercent === "number"
                ? `${Math.round(buildPercent)}% — writing real React Native code…`
                : awaitingUpdate && status.phase === "ready"
                  ? "Still working in the background — not frozen. A few minutes on first builds."
                  : PHASE_LABEL[status.phase]}
            </p>
          </div>
        )}

        {status.phase === "error" && !compiling && !showIframe && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[1.7rem] bg-cream/95 px-6 text-center">
            <TriangleAlert className="h-7 w-7 text-coral" />
            <p className="text-xs font-semibold text-charcoal">
              {PHASE_LABEL.error}
            </p>
            <p className="text-[11px] leading-relaxed text-warmgrey">
              {status.error ?? "Couldn't compile the web build."}
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-coral px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-coral-deep"
            >
              <RefreshCw className="h-3 w-3" /> Rebuild app
            </button>
          </div>
        )}

        {!showIframe && !compiling && status.phase !== "error" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[1.7rem] bg-cream/95 px-6 text-center">
            <Smartphone className="h-7 w-7 text-coral/60" />
            <p className="text-[11px] leading-relaxed text-warmgrey">
              Your real app preview loads here once it&apos;s built.
            </p>
          </div>
        )}

        {showWatermark && showIframe && (
          <span className="absolute bottom-2 left-1/2 z-20 -translate-x-1/2 rounded-full bg-charcoal/70 px-2 py-0.5 text-[9px] font-medium text-cream">
            Built with Appable
          </span>
        )}
      </div>

      {showIframe && (
        <button
          type="button"
          onClick={retry}
          className="absolute -right-2 -top-2 z-30 inline-flex items-center gap-1 rounded-full border border-line/60 bg-white px-2 py-1 text-[10px] font-semibold text-charcoal shadow-sm transition hover:bg-sand/50"
          title="Rebuild the web preview from your latest code"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      )}

      {statusLine && (
        <div
          className={cn(
            "mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] font-medium",
            compiling && "text-warmgrey",
            justReady && "text-emerald-700",
            !compiling && !justReady && status.phase === "ready" && "text-warmgrey",
            status.phase === "error" && "text-coral"
          )}
        >
          {compiling && <Loader2 className="h-3 w-3 shrink-0 animate-spin text-coral" />}
          {justReady && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
          )}
          <span>{statusLine}</span>
        </div>
      )}
    </div>
  );
});
