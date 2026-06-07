"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  ChefHat,
  Utensils,
  ShoppingCart,
  List,
  User,
  Camera,
  Heart,
  BookOpen,
  Search,
  Settings,
  Bell,
  Shield,
  HelpCircle,
  ChevronRight,
  X,
  Check,
  Mic,
  Volume2,
  Upload,
  ImageIcon,
  Share2,
} from "lucide-react";
import type {
  ExpoAppCapabilities,
  ExpoAppModel,
  ExpoIconName,
  ExpoListItem,
} from "@/lib/expoApp/types";
import { imageForCategory } from "@/lib/expoApp/images";
import {
  applyImageFallbacks,
  collectModelImageUrls,
  preloadImages,
} from "@/lib/expoApp/preloadImages";
import {
  buildPreviewUiConfigFromModel,
  uiFeatureEnabled,
} from "@/lib/expoApp/previewFeatures";
import {
  buildPreviewInteractionConfig,
  extractCollectionLines,
  isListsTab,
  resolveTabScreen,
  shareContent,
  sharePayload,
  type SettingBinding,
} from "@/lib/expoApp/previewInteractions";
import { recipeListenText } from "@/lib/expoApp/recipeDetails";
import { cn } from "@/lib/utils";
import {
  previewDeviceKind,
  previewSupportsMic,
  previewSupportsWebcam,
  type PreviewDeviceKind,
} from "@/lib/previewDevice";

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function callLiveAi(body: Record<string, string | undefined>) {
  const res = await fetch("/api/ai/live", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<{
    ok?: boolean;
    output?: string;
    message?: string;
    audioUrl?: string;
  }>;
}

const ICONS: Record<
  ExpoIconName,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  home: Home,
  "chef-hat": ChefHat,
  utensils: Utensils,
  "shopping-cart": ShoppingCart,
  list: List,
  user: User,
  camera: Camera,
  heart: Heart,
  "book-open": BookOpen,
  search: Search,
  settings: Settings,
  bell: Bell,
  shield: Shield,
  "help-circle": HelpCircle,
};

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35 },
  }),
};

/** Never show a broken/grey box — fade in only after pixels load, swap to fallback on error. */
function CoverImage({
  src,
  className,
  category = "general",
  fallbackIndex = 0,
}: {
  src: string;
  className?: string;
  category?: string;
  fallbackIndex?: number;
}) {
  const [url, setUrl] = useState(src);
  const [ready, setReady] = useState(false);
  const fallback = imageForCategory(category, fallbackIndex);

  useEffect(() => {
    setUrl(src);
    setReady(false);
  }, [src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={cn(className, "transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")}
      onLoad={() => setReady(true)}
      onError={() => {
        if (url !== fallback) {
          setReady(false);
          setUrl(fallback);
        }
      }}
    />
  );
}

/**
 * Premium in-browser preview driven by ExpoAppModel — real content, motion,
 * icons, images, working navigation. Same model future Tamagui codegen uses.
 */
function defaultCapabilities(model: ExpoAppModel): ExpoAppCapabilities {
  const ui = buildPreviewUiConfigFromModel(model);
  const stored = model.capabilities;
  const uiFeatures = [
    ...new Set([...ui.features, ...(stored?.uiFeatures ?? [])]),
  ];
  return {
    enabled: stored?.enabled ?? [],
    uiFeatures,
    heroAction: stored?.heroAction ?? model.home.heroLabel,
    heroSublabel: stored?.heroSublabel ?? model.home.heroSublabel,
    visionPrompt:
      stored?.visionPrompt ??
      `Help the user with: ${model.home.heroLabel}. ${model.home.heroSublabel}`,
  };
}

export function ExpoLivePreview({
  projectId,
  model,
  building,
  buildPercent,
  startPastOnboarding,
  alive,
  className,
}: {
  projectId?: string;
  model: ExpoAppModel | null;
  building?: boolean;
  buildPercent?: number;
  startPastOnboarding?: boolean;
  /** Extra motion / glow when build is complete. */
  alive?: boolean;
  className?: string;
}) {
  const [onboardIdx, setOnboardIdx] = useState(0);
  const [onboarded, setOnboarded] = useState(Boolean(startPastOnboarding));
  const [tab, setTab] = useState(model?.tabs[0]?.id ?? "home");
  const [detail, setDetail] = useState<ExpoListItem | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [scanOpen, setScanOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanText, setScanText] = useState<string | null>(null);
  const [cameraPickerOpen, setCameraPickerOpen] = useState(false);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceText, setVoiceText] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);
  const [displayModel, setDisplayModel] = useState<ExpoAppModel | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [extraListItems, setExtraListItems] = useState<ExpoListItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [settingsRow, setSettingsRow] = useState<string | null>(null);
  const [settingsToggles, setSettingsToggles] = useState<Record<string, boolean>>({});
  const [deviceKind, setDeviceKind] = useState<PreviewDeviceKind>("desktop");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);

  const previewModel = displayModel ?? model;
  const theme = previewModel?.theme;
  const showLive =
    previewModel && (!building || (buildPercent ?? 0) >= 55) && imagesReady;
  const caps = previewModel ? defaultCapabilities(previewModel) : null;
  const ix = useMemo(
    () => (previewModel ? buildPreviewInteractionConfig(previewModel) : null),
    [previewModel]
  );
  const canScan =
    ix?.heroMode === "vision_scan" &&
    caps?.enabled.includes("vision_ai") &&
    !building &&
    imagesReady;
  const canVoice = caps?.enabled.includes("speech_to_text") && !building && previewSupportsMic();
  const canTts = caps?.enabled.includes("text_to_speech") && !building;
  const canSave = uiFeatureEnabled(caps?.uiFeatures, "save_favorite");
  const canShare = uiFeatureEnabled(caps?.uiFeatures, "share");
  const canAddToCollection = uiFeatureEnabled(caps?.uiFeatures, "add_to_collection");
  const collectionTabId = ix?.collectionTabId ?? "lists";
  const collectionLabel = ix?.collectionActionLabel ?? "Add to collection";
  const resolvedTab = previewModel ? resolveTabScreen(previewModel, tab) : null;

  useEffect(() => {
    setDeviceKind(previewDeviceKind());
  }, []);

  useEffect(() => {
    if (!model) {
      setImagesReady(false);
      setDisplayModel(null);
      return;
    }
    let cancelled = false;
    setImagesReady(false);
    const urls = collectModelImageUrls(model);
    const category = model.category ?? "general";
    void preloadImages(urls, category).then((urlMap) => {
      if (cancelled) return;
      setDisplayModel(applyImageFallbacks(model, urlMap));
      setImagesReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [model]);

  useEffect(() => {
    if (!displayModel) return;
    const valid = displayModel.tabs.some((t) => t.id === tab);
    if (!valid) setTab(displayModel.tabs[0]?.id ?? "home");
  }, [displayModel, tab]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  function toggleSave(item: ExpoListItem) {
    setSavedIds((s) => {
      const n = new Set(s);
      const was = n.has(item.id);
      if (was) n.delete(item.id);
      else n.add(item.id);
      setToast(was ? (ix?.toasts.unsaved ?? "Removed from saved") : ix?.toasts.saved(item.title) ?? `Saved ${item.title}`);
      return n;
    });
  }

  function addToCollection(item: ExpoListItem) {
    if (!ix) return;
    const lines = extractCollectionLines(item, ix.collectionExtract);

    const added = lines.map((line, i) => ({
      id: `c-${item.id}-${i}-${Date.now()}`,
      title: line.length > 48 ? `${line.slice(0, 45)}…` : line,
      subtitle: `From ${item.title}`,
      meta: collectionLabel.replace(/^Add to /i, ""),
      imageUrl: imageForCategory(ix.category, i),
      detailType: "list" as const,
    }));

    setExtraListItems((prev) => [...prev, ...added]);
    setChecked((s) => {
      const n = new Set(s);
      added.forEach((a) => n.add(a.id));
      return n;
    });
    setDetail(null);
    setTab(collectionTabId);
    setToast(ix.toasts.addedToCollection(added.length, collectionLabel));
  }

  function handleHeroAction() {
    if (!previewModel || !ix) return;
    if (ix.heroMode === "vision_scan" && canScan) {
      openScanPicker();
      return;
    }
    if (ix.heroMode === "goto_tab" && ix.heroFallbackTabId) {
      const label =
        previewModel.tabs.find((t) => t.id === ix.heroFallbackTabId)?.label ??
        ix.heroFallbackTabId;
      setTab(ix.heroFallbackTabId);
      setToast(ix.toasts.heroTab(label));
      return;
    }
    const first = previewModel.home.sections[0]?.items[0];
    if (first && (ix.heroMode === "open_content" || ix.heroMode === "quick_capture")) {
      setDetail(first);
      setToast(ix.toasts.heroOpen(first.title));
      return;
    }
    if (ix.heroFallbackTabId) {
      const label =
        previewModel.tabs.find((t) => t.id === ix.heroFallbackTabId)?.label ??
        ix.heroFallbackTabId;
      setTab(ix.heroFallbackTabId);
      setToast(ix.toasts.heroTab(label));
    }
  }

  async function handleShare(item: ExpoListItem) {
    if (!previewModel || !ix) return;
    const payload = sharePayload(item, ix.appName, ix);
    const result = await shareContent(payload);
    if (result === "shared") setToast("Shared!");
    else if (result === "copied") setToast("Copied to clipboard");
    else setToast("Share not available on this device");
  }

  async function handleShareList() {
    if (!previewModel || !ix || !resolvedTab?.screen) return;
    const items = [
      ...resolvedTab.screen.items,
      ...(tab === collectionTabId ? extraListItems : []),
    ];
    const text = items.map((it) => `• ${it.title}`).join("\n");
    const result = await shareContent({
      title: ix.share.listTitle,
      text: text || "My list",
    });
    if (result === "shared") setToast("List shared!");
    else if (result === "copied") setToast("List copied");
  }

  function openLegal(doc: "privacy" | "terms" | "support") {
    if (!projectId) {
      setToast("Legal pages ship with your published app");
      return;
    }
    window.open(`/legal/${projectId}/${doc}`, "_blank", "noopener,noreferrer");
    setSettingsRow(null);
    setToast(`Opened ${doc}`);
  }

  useEffect(() => {
    if (!theme) return;
    const families = [
      theme.fontDisplay ?? "Fraunces",
      theme.fontBody ?? "DM Sans",
    ];
    const href = `https://fonts.googleapis.com/css2?family=${families
      .map((f) => f.replace(/ /g, "+") + ":wght@400;600;700;800")
      .join("&family=")}&display=swap`;
    const id = "appable-preview-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [theme]);

  async function handleScanFile(file: File) {
    if (!caps) return;
    setCameraPickerOpen(false);
    setWebcamOpen(false);
    setScanBusy(true);
    setScanOpen(true);
    setScanText(null);
    try {
      const dataUrl = await blobToDataUrl(file);
      const data = await callLiveAi({
        capability: "photo recipe vision scan",
        imageUrl: dataUrl,
        text: caps.visionPrompt,
      });
      if (data.ok) setScanText(data.output ?? null);
      else setScanText(data.message ?? "Couldn't analyze that photo.");
    } catch {
      setScanText("Something went wrong — try another photo.");
    } finally {
      setScanBusy(false);
    }
  }

  function openScanPicker() {
    if (!canScan) return;
    setCameraPickerOpen(true);
  }

  async function playTts(text: string) {
    if (!canTts || !text.trim()) return;
    setTtsBusy(true);
    try {
      const data = await callLiveAi({
        capability: "read aloud tts",
        text: text.slice(0, 500),
      });
      const audioSrc =
        data.audioUrl ??
        (data.output?.startsWith("data:audio") ? data.output : undefined);
      if (data.ok && audioSrc) {
        const audio = new Audio(audioSrc);
        await audio.play();
      } else if (!data.ok) {
        setScanText((prev) => prev ?? data.message ?? "Couldn't read aloud.");
        setScanOpen(true);
      }
    } catch {
      /* ignore playback errors */
    } finally {
      setTtsBusy(false);
    }
  }

  function stopRecordingStream() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordStreamRef.current = null;
    setRecording(false);
  }

  async function startVoiceCapture() {
    if (!canVoice || recording) return;
    setVoiceOpen(true);
    setVoiceText(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recordChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) recordChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(recordChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size < 200) {
          setVoiceText("Didn't catch that — try again.");
          setVoiceBusy(false);
          return;
        }
        setVoiceBusy(true);
        try {
          const dataUrl = await blobToDataUrl(blob);
          const base64 = dataUrl.split(",")[1];
          const data = await callLiveAi({
            capability: "transcribe voice speech to text",
            audioBase64: base64,
            audioMimeType: blob.type || "audio/webm",
          });
          if (data.ok) setVoiceText(data.output ?? "Got it.");
          else setVoiceText(data.message ?? "Couldn't transcribe.");
        } catch {
          setVoiceText("Something went wrong — try again.");
        } finally {
          setVoiceBusy(false);
        }
      };
      recorder.start();
      setRecording(true);
    } catch {
      setVoiceText("Microphone access blocked. Allow mic in your browser.");
      setVoiceOpen(true);
    }
  }

  function finishVoiceCapture() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
  }

  useEffect(() => {
    return () => {
      stopRecordingStream();
    };
  }, []);

  const fontStyle = theme
    ? {
        fontFamily: `"${theme.fontBody ?? "DM Sans"}", system-ui, sans-serif`,
        ["--font-display" as string]: `"${theme.fontDisplay ?? "Fraunces"}", Georgia, serif`,
      }
    : undefined;

  if (!model && building) {
    return (
      <PhoneShell className={className}>
        <BuildingSkeleton percent={buildPercent ?? 0} accent="#FF7A63" />
      </PhoneShell>
    );
  }

  if (!model) return null;

  if (!imagesReady || !displayModel) {
    return (
      <PhoneShell className={className}>
        <BuildingSkeleton
          percent={building ? (buildPercent ?? 0) : 96}
          accent={model.theme?.accent ?? "#FF7A63"}
          label={building ? undefined : "Loading photos…"}
        />
      </PhoneShell>
    );
  }

  const t = theme!;
  const readyModel = displayModel;

  return (
    <div className={cn("mx-auto w-full max-w-[340px]", className)}>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture={deviceKind === "mobile" ? "environment" : undefined}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleScanFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleScanFile(f);
          e.target.value = "";
        }}
      />
      <PhoneShell alive={alive}>
        <div className="flex h-full flex-col" style={{ background: t.cream, ...fontStyle }}>
          <StatusBar />

          <div className="relative min-h-0 flex-1 overflow-hidden px-3 pb-0 pt-1">
            <AnimatePresence mode="wait">
              {building && !showLive ? (
                <BuildingSkeleton key="skel" percent={buildPercent ?? 0} accent={t.accent} />
              ) : !onboarded ? (
                <Onboarding
                  key="ob"
                  model={readyModel}
                  idx={onboardIdx}
                  onNext={() => {
                    if (onboardIdx < readyModel.onboarding.length - 1) {
                      setOnboardIdx((i) => i + 1);
                    } else {
                      confetti({
                        particleCount: 55,
                        spread: 72,
                        origin: { y: 0.72 },
                        colors: [readyModel.theme.accent, readyModel.theme.cream, "#fff"],
                      });
                      setOnboarded(true);
                      setTab("home");
                    }
                  }}
                  onSkip={() => {
                    setOnboarded(true);
                    setTab("home");
                  }}
                />
              ) : tab === "home" ? (
                <HomeScreen
                  key="home"
                  model={readyModel}
                  onOpen={setDetail}
                  onHero={handleHeroAction}
                  hasScan={canScan}
                  onVoice={canVoice ? () => setVoiceOpen(true) : undefined}
                  scanning={scanBusy}
                  recording={recording}
                />
              ) : tab === "profile" ? (
                <ProfileScreen
                  key="profile"
                  model={readyModel}
                  savedCount={savedIds.size}
                  savedStatPatterns={ix?.savedStatPatterns}
                  onSetting={(label) => setSettingsRow(label)}
                />
              ) : (
                <TabScreen
                  key={tab}
                  screen={resolvedTab?.screen}
                  tabId={resolvedTab?.resolvedId ?? tab}
                  theme={t}
                  checked={checked}
                  onToggle={(id) => {
                    setChecked((s) => {
                      const n = new Set(s);
                      if (n.has(id)) n.delete(id);
                      else n.add(id);
                      return n;
                    });
                  }}
                  onOpen={setDetail}
                  extraItems={
                    tab === collectionTabId ? extraListItems : undefined
                  }
                  listsTab={ix ? isListsTab(tab, ix) : false}
                  onShareList={canShare ? handleShareList : undefined}
                />
              )}
            </AnimatePresence>

            {detail && (
              <DetailSheet
                item={detail}
                theme={t}
                onClose={() => setDetail(null)}
                onListen={canTts ? () => void playTts(recipeListenText(detail)) : undefined}
                listenBusy={ttsBusy}
                onSave={canSave ? () => toggleSave(detail) : undefined}
                isSaved={savedIds.has(detail.id)}
                onAddToList={canAddToCollection ? () => addToCollection(detail) : undefined}
                onShare={canShare ? () => void handleShare(detail) : undefined}
                collectionLabel={collectionLabel}
              />
            )}
            {settingsRow && (
              <SettingsSheet
                label={settingsRow}
                theme={t}
                binding={ix?.settings[settingsRow]}
                projectId={projectId}
                toggled={
                  settingsToggles[settingsRow] ??
                  ix?.settings[settingsRow]?.toggleDefault ??
                  true
                }
                onToggle={(on) => {
                  setSettingsToggles((s) => ({ ...s, [settingsRow]: on }));
                  setToast(`${settingsRow} ${on ? "on" : "off"}`);
                }}
                onOpenLegal={openLegal}
                onClose={() => setSettingsRow(null)}
              />
            )}
            {toast && (
              <div
                className="absolute inset-x-3 top-12 z-40 rounded-xl px-2.5 py-2 text-center text-[10px] font-semibold text-white shadow-soft"
                style={{ background: t.accent }}
              >
                {toast}
              </div>
            )}
            {cameraPickerOpen && (
              <CameraSourceSheet
                theme={t}
                deviceKind={deviceKind}
                onClose={() => setCameraPickerOpen(false)}
                onWebcam={() => {
                  setCameraPickerOpen(false);
                  setWebcamOpen(true);
                }}
                onCamera={() => {
                  setCameraPickerOpen(false);
                  cameraRef.current?.click();
                }}
                onGallery={() => {
                  setCameraPickerOpen(false);
                  fileRef.current?.click();
                }}
              />
            )}
            {webcamOpen && (
              <WebcamCapture
                theme={t}
                onClose={() => setWebcamOpen(false)}
                onCapture={(file) => void handleScanFile(file)}
              />
            )}
            {voiceOpen && (
              <VoiceSheet
                theme={t}
                busy={voiceBusy}
                recording={recording}
                text={voiceText}
                onClose={() => {
                  finishVoiceCapture();
                  setVoiceOpen(false);
                }}
                onStart={() => void startVoiceCapture()}
                onStop={finishVoiceCapture}
              />
            )}
            {scanOpen && (
              <ScanSheet
                theme={t}
                busy={scanBusy}
                text={scanText}
                onClose={() => setScanOpen(false)}
                onListen={canTts && scanText ? () => void playTts(scanText) : undefined}
                listenBusy={ttsBusy}
              />
            )}
          </div>

          {onboarded && imagesReady && (
            <TabBar tabs={readyModel.tabs} active={tab} theme={t} onSelect={setTab} />
          )}

          <HomeIndicator />

          {building && (
            <div
              className="absolute inset-x-4 bottom-14 z-20 rounded-xl px-3 py-1.5 text-center text-[9px] font-bold text-white shadow-soft"
              style={{ background: t.accent }}
            >
              Building… {Math.min(100, buildPercent ?? 0)}%
            </div>
          )}
        </div>
      </PhoneShell>

      {!building && showLive && (
        <p className="mt-3 text-center text-[11px] leading-snug text-warmgrey">
          Tap any card → <strong className="text-charcoal">Save</strong>
          {canAddToCollection ? (
            <>
              {" "}
              or <strong className="text-charcoal">{collectionLabel}</strong>
            </>
          ) : null}
          . Profile settings work.{" "}
          {canScan ? (
            <>
              <strong className="text-charcoal">Scan</strong>
              {deviceKind === "desktop" ? " (webcam/upload)" : ""} for live AI.
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}

function PhoneShell({
  children,
  className,
  alive,
}: {
  children?: React.ReactNode;
  className?: string;
  alive?: boolean;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[340px]", className)}>
      <motion.div
        animate={
          alive
            ? {
                boxShadow: [
                  "0 20px 50px -12px rgba(255,122,99,0.15)",
                  "0 24px 56px -8px rgba(255,122,99,0.28)",
                  "0 20px 50px -12px rgba(255,122,99,0.15)",
                ],
              }
            : undefined
        }
        transition={alive ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : undefined}
        className="relative rounded-[2.4rem] p-[5px] shadow-[0_20px_50px_-12px_rgba(43,38,36,0.22)]"
        style={{
          background: alive
            ? "linear-gradient(145deg, #4a3f3c 0%, #2a2624 45%, #3d3836 100%)"
            : "linear-gradient(145deg, #3d3836 0%, #1f1c1b 55%, #2a2624 100%)",
        }}
      >
        <span className="absolute -left-[2px] top-[22%] h-8 w-[3px] rounded-l bg-charcoal/60" />
        <span className="absolute -left-[2px] top-[34%] h-12 w-[3px] rounded-l bg-charcoal/60" />
        <span className="absolute -right-[2px] top-[28%] h-14 w-[3px] rounded-r bg-charcoal/60" />
        <div className="relative flex aspect-[9/19.5] flex-col overflow-hidden rounded-[2rem]">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function CameraSourceSheet({
  theme,
  deviceKind,
  onClose,
  onWebcam,
  onCamera,
  onGallery,
}: {
  theme: ExpoAppModel["theme"];
  deviceKind: PreviewDeviceKind;
  onClose: () => void;
  onWebcam: () => void;
  onCamera: () => void;
  onGallery: () => void;
}) {
  const isDesktop = deviceKind === "desktop";
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-40 flex flex-col justify-end bg-charcoal/40"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        className="rounded-t-2xl p-3"
        style={{ background: theme.card }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 text-[10px] font-bold" style={{ color: theme.charcoal }}>
          {isDesktop ? "Add a photo" : "Scan a photo"}
        </p>
        <div className="space-y-1.5">
          {isDesktop && previewSupportsWebcam() && (
            <button
              type="button"
              onClick={onWebcam}
              className="flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left"
              style={{ borderColor: theme.line, background: theme.cream }}
            >
              <Camera className="h-3.5 w-3.5" style={{ color: theme.accent }} />
              <span className="text-[10px] font-semibold" style={{ color: theme.charcoal }}>
                Use webcam
              </span>
            </button>
          )}
          {!isDesktop && (
            <button
              type="button"
              onClick={onCamera}
              className="flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left"
              style={{ borderColor: theme.line, background: theme.cream }}
            >
              <Camera className="h-3.5 w-3.5" style={{ color: theme.accent }} />
              <span className="text-[10px] font-semibold" style={{ color: theme.charcoal }}>
                Take photo (camera)
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onGallery}
            className="flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left"
            style={{ borderColor: theme.line, background: theme.cream }}
          >
            {isDesktop ? (
              <Upload className="h-3.5 w-3.5" style={{ color: theme.accent }} />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" style={{ color: theme.accent }} />
            )}
            <span className="text-[10px] font-semibold" style={{ color: theme.charcoal }}>
              {isDesktop ? "Upload from computer" : "Choose from gallery"}
            </span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function WebcamCapture({
  theme,
  onClose,
  onCapture,
}: {
  theme: ExpoAppModel["theme"];
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      })
      .catch(() => onClose());
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onClose]);

  function snap() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], "webcam.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 flex flex-col bg-charcoal"
    >
      <video ref={videoRef} className="min-h-0 flex-1 object-cover" playsInline muted />
      <div className="flex shrink-0 gap-2 p-3" style={{ background: theme.card }}>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border py-2 text-[10px] font-bold"
          style={{ borderColor: theme.line, color: theme.muted }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={snap}
          className="flex-[2] rounded-xl py-2 text-[10px] font-bold text-white"
          style={{ background: theme.accent }}
        >
          Capture
        </button>
      </div>
    </motion.div>
  );
}

function VoiceSheet({
  theme,
  busy,
  recording,
  text,
  onClose,
  onStart,
  onStop,
}: {
  theme: ExpoAppModel["theme"];
  busy: boolean;
  recording: boolean;
  text: string | null;
  onClose: () => void;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      className="absolute inset-x-0 bottom-0 z-30 max-h-[70%] overflow-y-auto rounded-t-2xl p-3 shadow-lg"
      style={{ background: theme.card }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold" style={{ color: theme.charcoal }}>
          {busy ? "Transcribing…" : recording ? "Listening…" : "Voice note"}
        </p>
        <button type="button" onClick={onClose} className="p-1">
          <X className="h-3.5 w-3.5" style={{ color: theme.muted }} />
        </button>
      </div>
      {busy ? (
        <div className="space-y-2 py-4">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-2 rounded-full"
              style={{ background: theme.line, width: `${70 - i * 12}%` }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      ) : text ? (
        <p className="whitespace-pre-wrap text-[10px] leading-relaxed" style={{ color: theme.charcoal }}>
          {text}
        </p>
      ) : (
        <p className="text-[10px] leading-relaxed" style={{ color: theme.muted }}>
          Hold the mic while you talk — great for hands-free cooking notes.
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onMouseDown={onStart}
        onMouseUp={onStop}
        onMouseLeave={recording ? onStop : undefined}
        onTouchStart={(e) => {
          e.preventDefault();
          onStart();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          onStop();
        }}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[9px] font-bold text-white disabled:opacity-60"
        style={{ background: recording ? theme.charcoal : theme.accent }}
      >
        <Mic className="h-4 w-4" />
        {recording ? "Release to send" : "Hold to speak"}
      </button>
    </motion.div>
  );
}

function ScanSheet({
  theme,
  busy,
  text,
  onClose,
  onListen,
  listenBusy,
}: {
  theme: ExpoAppModel["theme"];
  busy: boolean;
  text: string | null;
  onClose: () => void;
  onListen?: () => void;
  listenBusy?: boolean;
}) {
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      className="absolute inset-x-0 bottom-0 z-30 max-h-[70%] overflow-y-auto rounded-t-2xl p-3 shadow-lg"
      style={{ background: theme.card }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-bold" style={{ color: theme.charcoal, fontFamily: `var(--font-display)` }}>
          {busy ? "Reading your photo…" : "Your result"}
        </p>
        <button type="button" onClick={onClose} className="p-1">
          <X className="h-3.5 w-3.5" style={{ color: theme.muted }} />
        </button>
      </div>
      {busy ? (
        <div className="space-y-2 py-4">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-2 rounded-full"
              style={{ background: theme.line, width: `${70 - i * 12}%` }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-[10px] leading-relaxed" style={{ color: theme.charcoal }}>
            {text}
          </p>
          {onListen && text && (
            <button
              type="button"
              disabled={listenBusy}
              onClick={onListen}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[10px] font-bold text-white disabled:opacity-60"
              style={{ background: theme.accent }}
            >
              <Volume2 className="h-3.5 w-3.5" />
              {listenBusy ? "Generating audio…" : "Listen"}
            </button>
          )}
        </>
      )}
    </motion.div>
  );
}

function StatusBar() {
  return (
    <div className="flex shrink-0 items-center justify-between px-4 pt-2.5">
      <span className="text-[9px] font-semibold text-charcoal/70">9:41</span>
      <div className="h-[18px] w-[72px] rounded-full bg-charcoal/90" aria-hidden />
      <div className="flex gap-[3px]">
        <span className="h-2 w-2 rounded-sm bg-charcoal/50" />
        <span className="h-2 w-3 rounded-sm bg-charcoal/50" />
      </div>
    </div>
  );
}

function HomeIndicator() {
  return (
    <div className="flex shrink-0 justify-center pb-2 pt-0.5">
      <span className="h-1 w-16 rounded-full bg-charcoal/20" />
    </div>
  );
}

function Onboarding({
  model,
  idx,
  onNext,
  onSkip,
}: {
  model: ExpoAppModel;
  idx: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  const slide = model.onboarding[idx];
  const t = model.theme;
  const isLast = idx >= model.onboarding.length - 1;
  const cta =
    slide.ctaLabel ?? (isLast ? "Let's go" : "Next");
  const kindLabel =
    slide.kind === "feature_demo"
      ? "Feature demo"
      : slide.kind === "personalization"
        ? "Your setup"
        : slide.kind === "completion"
          ? "Ready"
          : "Preview";

  return (
    <motion.div
      key={idx}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex h-full flex-col"
    >
      <div
        className="relative mb-2 overflow-hidden rounded-2xl"
        style={{
          aspectRatio: "4/3",
          background: `linear-gradient(145deg, ${t.accent}22 0%, ${t.cream} 55%, ${t.card} 100%)`,
        }}
      >
        <CoverImage
          src={slide.imageUrl}
          category={model.category}
          className="h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 backdrop-blur-[1px]"
          style={{
            background: `linear-gradient(180deg, ${t.accent}18 0%, transparent 35%, ${t.cream} 100%)`,
          }}
        />
        {slide.demonstrates && (
          <span
            className="absolute left-2 top-2 rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm"
            style={{ background: `${t.accent}dd` }}
          >
            {kindLabel}: {slide.demonstrates.slice(0, 28)}
            {slide.demonstrates.length > 28 ? "…" : ""}
          </span>
        )}
      </div>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className="text-[13px] font-extrabold leading-tight"
        style={{ color: t.charcoal }}
      >
        {slide.title}
      </motion.p>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="mt-1 flex-1 text-[9px] leading-snug"
        style={{ color: t.muted }}
      >
        {slide.subtitle}
      </motion.p>
      <div className="mb-2 flex justify-center gap-1.5">
        {model.onboarding.map((_, i) => (
          <span
            key={i}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === idx ? 14 : 6,
              background: i === idx ? t.accent : t.line,
            }}
          />
        ))}
      </div>
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={onNext}
        className="w-full rounded-2xl py-2.5 text-[10px] font-bold text-white shadow-soft"
        style={{
          background: `linear-gradient(135deg, ${t.accent} 0%, ${t.charcoal} 140%)`,
        }}
      >
        {cta}
      </motion.button>
      {!isLast && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-1.5 text-center text-[9px] font-semibold"
          style={{ color: t.muted }}
        >
          Skip
        </button>
      )}
    </motion.div>
  );
}

function HomeScreen({
  model,
  onOpen,
  onHero,
  hasScan,
  onVoice,
  scanning,
  recording,
}: {
  model: ExpoAppModel;
  onOpen: (item: ExpoListItem) => void;
  onHero: () => void;
  hasScan?: boolean;
  onVoice?: () => void;
  scanning?: boolean;
  recording?: boolean;
}) {
  const t = model.theme;
  const h = model.home;
  const displayFont = { fontFamily: `var(--font-display), Georgia, serif` };
  return (
    <div className="h-full overflow-y-auto pb-2">
      <motion.p
        initial="hidden"
        animate="show"
        variants={fadeUp}
        custom={0}
        className="text-[12px] font-extrabold"
        style={{ color: t.charcoal, ...displayFont }}
      >
        {h.headline}
      </motion.p>
      <motion.p
        variants={fadeUp}
        custom={1}
        initial="hidden"
        animate="show"
        className="mt-0.5 text-[10px] leading-snug"
        style={{ color: t.muted }}
      >
        {h.subheadline}
      </motion.p>

      <motion.button
        type="button"
        variants={fadeUp}
        custom={2}
        initial="hidden"
        animate="show"
        whileTap={{ scale: 0.97 }}
        onClick={onHero}
        disabled={scanning}
        className="mt-2.5 flex w-full items-center gap-2 rounded-2xl p-2.5 text-left shadow-soft"
        style={{ background: t.accent }}
      >
        <motion.span
          animate={hasScan ? { scale: [1, 1.06, 1] } : undefined}
          transition={{ duration: 2.2, repeat: Infinity }}
          className="grid h-8 w-8 place-items-center rounded-xl bg-white/20"
        >
          {hasScan ? (
            <Camera className="h-4 w-4 text-white" />
          ) : (
            <ChevronRight className="h-4 w-4 text-white" />
          )}
        </motion.span>
        <span className="min-w-0 flex-1">
          <span className="block text-[9px] font-bold text-white">{h.heroLabel}</span>
          <span className="block truncate text-[9px] text-white/85">
            {scanning ? "Analyzing with AI vision…" : h.heroSublabel}
          </span>
        </span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/80" />
      </motion.button>

      {onVoice && (
        <motion.button
          type="button"
          variants={fadeUp}
          custom={2.5}
          initial="hidden"
          animate="show"
          whileTap={{ scale: 0.97 }}
          onClick={onVoice}
          className="mt-1.5 flex w-full items-center gap-2 rounded-2xl border p-2 text-left"
          style={{ borderColor: t.line, background: t.card }}
        >
          <span
            className="grid h-7 w-7 place-items-center rounded-xl"
            style={{ background: `${t.accent}18` }}
          >
            <Mic
              className="h-3.5 w-3.5"
              style={{ color: t.accent }}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold" style={{ color: t.charcoal }}>
              {recording ? "Listening…" : "Voice note"}
            </span>
            <span className="block text-[9px]" style={{ color: t.muted }}>
              Hold mic — real speech-to-text
            </span>
          </span>
        </motion.button>
      )}

      {h.sections.map((sec, si) => (
        <div key={sec.title} className="mt-3">
          <p
            className="mb-1.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ color: t.muted }}
          >
            {sec.title}
          </p>
          <div className="space-y-1.5">
            {sec.items.map((item, i) => (
              <ItemCard
                key={item.id}
                item={item}
                theme={t}
                index={si * 3 + i + 3}
                onOpen={() => onOpen(item)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TabScreen({
  screen,
  tabId,
  theme,
  checked,
  onToggle,
  onOpen,
  listsTab,
  extraItems,
  onShareList,
}: {
  screen: ExpoAppModel["tabScreens"][string] | undefined;
  tabId: string;
  theme: ExpoAppModel["theme"];
  checked: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (item: ExpoListItem) => void;
  listsTab?: boolean;
  extraItems?: ExpoListItem[];
  onShareList?: () => void;
}) {
  if (!screen) {
    return (
      <p className="text-[9px] text-warmgrey">Loading {tabId}…</p>
    );
  }
  const t = theme;
  const items = [...screen.items, ...(extraItems ?? [])];
  return (
    <div className="h-full overflow-y-auto pb-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-extrabold" style={{ color: t.charcoal }}>
            {screen.title}
          </p>
          <p className="text-[10px]" style={{ color: t.muted }}>
            {screen.subtitle}
          </p>
        </div>
        {onShareList && items.length > 0 && (
          <button
            type="button"
            onClick={onShareList}
            className="flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-bold"
            style={{ borderColor: t.line, color: t.accent, background: t.card }}
          >
            <Share2 className="h-3 w-3" />
            Share
          </button>
        )}
      </div>
      <div className="mt-2 space-y-1.5">
        {items.map((item, i) =>
          listsTab ? (
            <div
              key={item.id}
              className="flex w-full items-center gap-2 rounded-xl border p-2"
              style={{ borderColor: t.line, background: t.card }}
            >
              <button
                type="button"
                onClick={() => onToggle(item.id)}
                className="grid h-4 w-4 shrink-0 place-items-center rounded-md border"
                style={{
                  borderColor: checked.has(item.id) ? t.accent : t.line,
                  background: checked.has(item.id) ? t.accent : "transparent",
                }}
                aria-label={checked.has(item.id) ? "Uncheck" : "Check"}
              >
                {checked.has(item.id) && <Check className="h-2.5 w-2.5 text-white" />}
              </button>
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block text-[10px] font-bold" style={{ color: t.charcoal }}>
                  {item.title}
                </span>
                <span className="block text-[9px]" style={{ color: t.muted }}>
                  {item.subtitle}
                </span>
              </button>
            </div>
          ) : (
            <ItemCard
              key={item.id}
              item={item}
              theme={t}
              index={i}
              onOpen={() => onOpen(item)}
            />
          )
        )}
      </div>
    </div>
  );
}

function ItemCard({
  item,
  theme,
  index,
  onOpen,
}: {
  item: ExpoListItem;
  theme: { accent: string; charcoal: string; muted: string; line: string; card: string };
  index: number;
  onOpen: () => void;
}) {
  return (
    <motion.button
      type="button"
      variants={fadeUp}
      custom={index}
      initial="hidden"
      animate="show"
      onClick={onOpen}
      className="flex w-full gap-2 rounded-xl border p-1.5 text-left shadow-sm transition hover:shadow-md"
      style={{ borderColor: theme.line, background: theme.card }}
    >
      <CoverImage
        src={item.imageUrl}
        fallbackIndex={index}
        className="h-11 w-11 shrink-0 rounded-lg object-cover"
      />
      <span className="min-w-0 flex-1 py-0.5">
        <span className="flex items-start justify-between gap-1">
          <span className="text-[10px] font-bold leading-tight" style={{ color: theme.charcoal }}>
            {item.title}
          </span>
          {item.badge && (
            <span
              className="shrink-0 rounded-md px-1 py-0.5 text-[8px] font-bold uppercase"
              style={{ background: `${theme.accent}18`, color: theme.accent }}
            >
              {item.badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[9px] leading-snug" style={{ color: theme.muted }}>
          {item.subtitle}
        </span>
        {item.meta && (
          <span className="mt-0.5 block text-[8px] font-semibold" style={{ color: theme.accent }}>
            {item.meta}
          </span>
        )}
      </span>
    </motion.button>
  );
}

function ProfileScreen({
  model,
  savedCount,
  savedStatPatterns,
  onSetting,
}: {
  model: ExpoAppModel;
  savedCount: number;
  savedStatPatterns?: string[];
  onSetting: (label: string) => void;
}) {
  const t = model.theme;
  const p = model.profile;
  const stats = p.stats.map((s) => {
    const matchesSaved = savedStatPatterns?.length
      ? savedStatPatterns.some((p) => s.label.toLowerCase().includes(p))
      : /saved|favorite|bookmark/i.test(s.label);
    return matchesSaved
      ? { ...s, value: String(savedCount || Number(s.value) || 0) }
      : s;
  });
  return (
    <div className="h-full overflow-y-auto pb-2">
      <div className="flex items-center gap-2">
        <span
          className="grid h-10 w-10 place-items-center rounded-2xl text-sm font-bold text-white"
          style={{ background: t.accent }}
        >
          {p.displayName.charAt(0)}
        </span>
        <div>
          <p className="text-[11px] font-extrabold" style={{ color: t.charcoal }}>
            {p.displayName}
          </p>
          <p className="text-[9px]" style={{ color: t.muted }}>
            {p.tagline}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border py-2 text-center"
            style={{ borderColor: t.line, background: t.card }}
          >
            <p className="text-[10px] font-extrabold" style={{ color: t.charcoal }}>
              {s.value}
            </p>
            <p className="text-[8px] font-medium" style={{ color: t.muted }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>
      <p
        className="mb-1.5 mt-3 text-[9px] font-bold uppercase tracking-wide"
        style={{ color: t.muted }}
      >
        Settings
      </p>
      <div className="space-y-1">
        {p.settings.map((row) => {
          const Icon = ICONS[row.icon] ?? Settings;
          return (
            <button
              key={row.label}
              type="button"
              onClick={() => onSetting(row.label)}
              className="flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left transition active:scale-[0.98]"
              style={{ borderColor: t.line, background: t.card }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: t.accent }} />
              <span className="flex-1 text-[10px] font-semibold" style={{ color: t.charcoal }}>
                {row.label}
              </span>
              <ChevronRight className="h-3 w-3" style={{ color: t.muted }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TabBar({
  tabs,
  active,
  theme,
  onSelect,
}: {
  tabs: ExpoAppModel["tabs"];
  active: string;
  theme: ExpoAppModel["theme"];
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="flex shrink-0 border-t px-0.5 py-1"
      style={{ borderColor: theme.line, background: theme.card }}
    >
      {tabs.map((tab) => {
        const Icon = ICONS[tab.icon] ?? Home;
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className="flex flex-1 flex-col items-center gap-0.5 py-0.5"
          >
            <Icon
              className="h-3.5 w-3.5"
              style={{ color: on ? theme.accent : theme.muted }}
            />
            <span
              className="max-w-full truncate text-[9px] font-semibold"
              style={{ color: on ? theme.accent : theme.muted }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SettingsSheet({
  label,
  theme,
  binding,
  projectId,
  toggled,
  onToggle,
  onOpenLegal,
  onClose,
}: {
  label: string;
  theme: ExpoAppModel["theme"];
  binding?: SettingBinding;
  projectId?: string;
  toggled: boolean;
  onToggle: (on: boolean) => void;
  onOpenLegal: (doc: "privacy" | "terms" | "support") => void;
  onClose: () => void;
}) {
  const kind = binding?.kind ?? "info";
  const legalDoc = binding?.legalDoc;
  const description = binding?.description ?? `${label}. Saved for this session.`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-40 flex flex-col justify-end bg-charcoal/40"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        className="rounded-t-2xl p-3"
        style={{ background: theme.card }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-bold" style={{ color: theme.charcoal }}>
            {label}
          </p>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" style={{ color: theme.muted }} />
          </button>
        </div>
        <p className="text-[10px] leading-relaxed" style={{ color: theme.muted }}>
          {description}
        </p>
        {kind === "toggle" && (
          <button
            type="button"
            onClick={() => onToggle(!toggled)}
            className="mt-3 flex w-full items-center justify-between rounded-xl border px-3 py-2"
            style={{ borderColor: theme.line, background: theme.cream }}
          >
            <span className="text-[10px] font-semibold" style={{ color: theme.charcoal }}>
              {toggled ? "On" : "Off"}
            </span>
            <span
              className="h-5 w-9 rounded-full p-0.5 transition"
              style={{ background: toggled ? theme.accent : theme.line }}
            >
              <span
                className="block h-4 w-4 rounded-full bg-white shadow-sm transition"
                style={{ marginLeft: toggled ? "auto" : 0 }}
              />
            </span>
          </button>
        )}
        {kind === "legal" && legalDoc && (
          <button
            type="button"
            onClick={() => onOpenLegal(legalDoc)}
            className="mt-3 w-full rounded-xl border py-2 text-[9px] font-bold"
            style={{ borderColor: theme.line, color: theme.accent, background: theme.cream }}
          >
            {projectId ? `Open ${legalDoc} page` : "Included in published app"}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-xl py-2 text-[9px] font-bold text-white"
          style={{ background: theme.accent }}
        >
          Done
        </button>
      </motion.div>
    </motion.div>
  );
}

function DetailSheet({
  item,
  theme,
  onClose,
  onListen,
  listenBusy,
  onSave,
  isSaved,
  onAddToList,
  onShare,
  collectionLabel = "Add to collection",
}: {
  item: ExpoListItem;
  theme: ExpoAppModel["theme"];
  onClose: () => void;
  onListen?: () => void;
  listenBusy?: boolean;
  onSave?: () => void;
  isSaved?: boolean;
  onAddToList?: () => void;
  onShare?: () => void;
  collectionLabel?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-30 flex flex-col justify-end bg-charcoal/40"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="max-h-[75%] overflow-y-auto rounded-t-2xl p-3"
        style={{ background: theme.card }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-bold" style={{ color: theme.charcoal }}>
            {item.detailType === "recipe" ? "Recipe" : "Details"}
          </p>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" style={{ color: theme.muted }} />
          </button>
        </div>
        <CoverImage
          src={item.imageUrl}
          className="mb-2 h-24 w-full rounded-xl object-cover"
        />
        <p className="text-[11px] font-extrabold" style={{ color: theme.charcoal }}>
          {item.title}
        </p>
        <p className="mt-1 text-[10px] leading-relaxed" style={{ color: theme.muted }}>
          {item.subtitle}
        </p>
        {item.meta && (
          <p className="mt-1 text-[10px] font-semibold" style={{ color: theme.accent }}>
            {item.meta}
          </p>
        )}
        {item.body && (
          <p className="mt-2 text-[10px] leading-relaxed" style={{ color: theme.charcoal }}>
            {item.body}
          </p>
        )}
        {item.ingredients && item.ingredients.length > 0 && (
          <div className="mt-2">
            <p
              className="mb-1 text-[9px] font-bold uppercase tracking-wide"
              style={{ color: theme.muted }}
            >
              Ingredients
            </p>
            <ul className="space-y-0.5">
              {item.ingredients.map((ing) => (
                <li
                  key={ing}
                  className="text-[9px] leading-snug"
                  style={{ color: theme.charcoal }}
                >
                  · {ing}
                </li>
              ))}
            </ul>
          </div>
        )}
        {item.steps && item.steps.length > 0 && (
          <div className="mt-2">
            <p
              className="mb-1 text-[9px] font-bold uppercase tracking-wide"
              style={{ color: theme.muted }}
            >
              Steps
            </p>
            <ol className="space-y-1">
              {item.steps.map((step, i) => (
                <li
                  key={step}
                  className="text-[9px] leading-snug"
                  style={{ color: theme.charcoal }}
                >
                  <span className="font-bold" style={{ color: theme.accent }}>
                    {i + 1}.{" "}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              className="flex flex-1 min-w-[30%] items-center justify-center gap-1 rounded-xl border py-2 text-[10px] font-bold"
              style={{
                borderColor: isSaved ? theme.accent : theme.line,
                color: isSaved ? theme.accent : theme.charcoal,
                background: theme.cream,
              }}
            >
              <Heart className={cn("h-3 w-3", isSaved && "fill-current")} />
              {isSaved ? "Saved" : "Save"}
            </button>
          )}
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="flex flex-1 min-w-[30%] items-center justify-center gap-1 rounded-xl border py-2 text-[10px] font-bold"
              style={{ borderColor: theme.line, color: theme.charcoal, background: theme.cream }}
            >
              <Share2 className="h-3 w-3" />
              Share
            </button>
          )}
          {onAddToList && (
            <button
              type="button"
              onClick={onAddToList}
              className="w-full flex-[2] rounded-xl py-2 text-[10px] font-bold text-white"
              style={{ background: theme.accent }}
            >
              {collectionLabel}
            </button>
          )}
        </div>
        {onListen && (
          <button
            type="button"
            disabled={listenBusy}
            onClick={onListen}
            className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 text-[10px] font-bold disabled:opacity-60"
            style={{ borderColor: theme.line, color: theme.charcoal, background: theme.cream }}
          >
            <Volume2 className="h-3 w-3" />
            {listenBusy ? "Generating audio…" : "Listen"}
          </button>
        )}
        <button
          type="button"
          className="mt-1.5 w-full rounded-xl py-2.5 text-[9px] font-bold text-white"
          style={{ background: theme.charcoal }}
          onClick={onClose}
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}

function BuildingSkeleton({
  accent,
  percent,
  label,
}: {
  accent: string;
  percent: number;
  label?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-2">
      <div
        className="h-10 w-10 animate-pulse rounded-2xl"
        style={{ background: `${accent}33` }}
      />
      <div className="h-3 w-3/4 animate-pulse rounded-full bg-charcoal/10" />
      <p className="text-[9px] font-medium text-warmgrey">
        {label ??
          (percent < 25
            ? "Composing screens…"
            : percent < 50
              ? "Writing real copy…"
              : percent < 75
                ? "Quality check…"
                : "Almost ready…")}
      </p>
    </div>
  );
}
