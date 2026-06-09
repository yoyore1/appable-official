"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
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
  Loader2,
  X,
  Check,
  Mic,
  Volume2,
  Upload,
  ImageIcon,
  Share2,
} from "lucide-react";
import { AppleLogo, GoogleLogo } from "@/components/OAuthBrandIcons";
import type {
  ExpoAppCapabilities,
  ExpoAppFlow,
  ExpoAppModel,
  ExpoCartLine,
  ExpoIconName,
  ExpoListItem,
  ExpoMessageThread,
  ExpoUserRole,
} from "@/lib/expoApp/types";
import {
  appendThreadMessage,
  createThreadFromCompose,
} from "@/lib/expoApp/preview/patterns/messagingData";
import { previewTokens } from "@/lib/expoApp/preview/tokens";
import { ContentDetailPattern } from "@/components/preview/patterns/ContentDetail";
import { HomeDashboardPattern } from "@/components/preview/patterns/HomeDashboard";
import { ConversationView } from "@/components/preview/patterns/ConversationView";
import { PreviewComposeSheet } from "@/components/preview/primitives";
import { TabPatternView } from "@/components/preview/TabPatternView";
import { completeAuthFlow } from "@/lib/expoApp/authFlowDefaults";
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
  applyRoleToModel,
  buildPreviewInteractionConfig,
  extractCollectionLines,
  isListsTab,
  resolveTabScreen,
  shareContent,
  sharePayload,
  type SettingBinding,
} from "@/lib/expoApp/previewInteractions";
import {
  applyItemPatches,
  findTabId,
  resolveActionOutcome,
} from "@/lib/expoApp/previewActions";
import { withLegalSettings } from "@/lib/expoApp/smartInteractions";
import { recipeListenText } from "@/lib/expoApp/recipeDetails";
import type { TweakTarget } from "@/lib/expoApp/tweakPaths";
import { DeviceMockup } from "@/components/DeviceMockup";
import type { EditPick } from "@/components/PreviewEditChrome";
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

function RoleIcon({ value, className }: { value: string; className?: string }) {
  const v = value.trim();
  if (v.startsWith("data:image/") || /^https?:\/\//i.test(v)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={v} alt="" className={cn("h-full w-full object-cover", className)} />
    );
  }
  return <span className={className}>{v || "✦"}</span>;
}

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

type FixEditProps = {
  editMode?: boolean;
  editPick?: EditPick;
  selectedTarget?: TweakTarget | null;
  onSelectTarget?: (target: TweakTarget) => void;
};

type PickSurface = { path: string; label: string; field: string };

const SURFACE = {
  accent: (label: string): PickSurface => ({ path: "theme.accent", label, field: "brand color" }),
  card: (label: string): PickSurface => ({ path: "theme.card", label, field: "card background" }),
  cream: (label: string): PickSurface => ({ path: "theme.cream", label, field: "background" }),
  charcoal: (label: string): PickSurface => ({ path: "theme.charcoal", label, field: "text color" }),
  muted: (label: string): PickSurface => ({ path: "theme.muted", label, field: "muted text" }),
} as const;

function isTargetSelected(
  selected: TweakTarget | null | undefined,
  target: TweakTarget
): boolean {
  return selected?.path === target.path && selected?.label === target.label;
}

function SurfaceSelectable({
  editMode,
  editPick,
  path,
  label,
  field,
  selectedTarget,
  onSelectTarget,
  children,
  className,
  style,
  block,
  overlay,
}: FixEditProps & {
  path: string;
  label: string;
  field: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  block?: boolean;
  overlay?: boolean;
}) {
  if (!editMode || !onSelectTarget || editPick !== "surface") {
    return overlay ? null : <>{children}</>;
  }
  const target = { path, label, field };
  const selected = isTargetSelected(selectedTarget, target);
  const pick = (e: { stopPropagation: () => void; preventDefault: () => void }) => {
    e.stopPropagation();
    e.preventDefault();
    onSelectTarget(target);
  };
  if (overlay) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={pick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") pick(e);
        }}
        className={cn(
          "pointer-events-auto absolute inset-0 z-[1] touch-manipulation rounded-[inherit] transition",
          selected
            ? "ring-2 ring-inset ring-coral/70"
            : "hover:ring-2 hover:ring-inset hover:ring-coral/35"
        )}
        aria-label={label}
      />
    );
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={pick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") pick(e);
      }}
      style={style}
      className={cn(
        className,
        block && "block w-full cursor-pointer",
        "pointer-events-auto relative z-[2] touch-manipulation rounded-xl transition",
        selected
          ? "border-2 border-coral shadow-[0_0_0_2px_rgba(255,122,99,0.15)]"
          : "border-2 border-transparent hover:border-coral/35 active:border-coral/50"
      )}
    >
      {selected && <SelectionMarker />}
      {children}
    </div>
  );
}

function SelectionMarker() {
  return (
    <span
      className="pointer-events-none absolute -right-0.5 -top-2.5 z-[8] rounded-full border border-white/90 bg-coral px-1.5 py-0.5 text-[8px] font-bold leading-none tracking-wide text-white shadow-[0_2px_10px_rgba(255,122,99,0.5)]"
      aria-hidden
    >
      ✓
    </span>
  );
}

export function ExpoLivePreview({
  projectId,
  model,
  building,
  buildPercent,
  startPastOnboarding,
  alive,
  className,
  editMode,
  editPick = "content",
  editModeHint = "Tap anything to fix it",
  hideEditBanner = false,
  selectedTarget,
  onSelectTarget,
  showWatermark,
}: {
  projectId?: string;
  model: ExpoAppModel | null;
  building?: boolean;
  buildPercent?: number;
  /** Skip onboarding slides only — role + setup still run first when flow.roles exists. */
  startPastOnboarding?: boolean;
  /** Extra motion / glow when build is complete. */
  alive?: boolean;
  className?: string;
  /** Replit-style tap-to-fix — select elements instead of navigating. */
  editMode?: boolean;
  editPick?: EditPick;
  editModeHint?: string;
  /** Parent chrome shows the edit bar — hide the in-phone banner. */
  hideEditBanner?: boolean;
  selectedTarget?: TweakTarget | null;
  onSelectTarget?: (target: TweakTarget) => void;
  /** Free-tier "Made with Appable" badge on the preview. */
  showWatermark?: boolean;
}) {
  type LaunchPhase = "auth" | "role" | "setup" | "onboarding" | "main";
  const [launchPhase, setLaunchPhase] = useState<LaunchPhase>("main");
  const [onboardIdx, setOnboardIdx] = useState(0);
  const [onboarded, setOnboarded] = useState(Boolean(startPastOnboarding));
  const [selectedRole, setSelectedRole] = useState<ExpoUserRole | null>(null);
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
  const [itemPatches, setItemPatches] = useState<Record<string, Partial<ExpoListItem>>>(
    {}
  );
  const [injectedByTab, setInjectedByTab] = useState<Record<string, ExpoListItem[]>>(
    {}
  );
  const [compose, setCompose] = useState<{
    title: string;
    placeholder: string;
    sourceItemId: string;
    threadId?: string;
  } | null>(null);
  const [threads, setThreads] = useState<ExpoMessageThread[]>([]);
  const [cartLines, setCartLines] = useState<ExpoCartLine[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [settingsRow, setSettingsRow] = useState<string | null>(null);
  const [settingsToggles, setSettingsToggles] = useState<Record<string, boolean>>({});
  const [deviceKind, setDeviceKind] = useState<PreviewDeviceKind>("desktop");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const modelStructureSigRef = useRef<string | null>(null);
  const imageUrlMapRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!editMode) return;
    setDetail(null);
    setScanOpen(false);
    setVoiceOpen(false);
    setSettingsRow(null);
  }, [editMode]);

  const previewModel = displayModel ?? model;
  const roleId = selectedRole?.id ?? null;
  const viewModel = useMemo(() => {
    if (!previewModel) return null;
    const roleApplied = applyRoleToModel(previewModel, roleId);
    return applyItemPatches(roleApplied, itemPatches, injectedByTab);
  }, [previewModel, roleId, itemPatches, injectedByTab]);
  const theme = previewModel?.theme;
  const tokens = useMemo(() => (theme ? previewTokens(theme) : null), [theme]);
  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  useEffect(() => {
    const incoming = previewModel?.previewState?.threads;
    if (incoming?.length) setThreads(incoming);
  }, [previewModel?.previewState?.threads]);

  useEffect(() => {
    const incoming = previewModel?.previewState?.cart;
    if (incoming?.length) setCartLines(incoming);
  }, [previewModel?.previewState?.cart]);

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
  const resolvedTab = viewModel ? resolveTabScreen(viewModel, tab) : null;

  useEffect(() => {
    setDeviceKind(previewDeviceKind());
  }, []);

  useEffect(() => {
    if (!model) return;
    const sig = modelStructureSignature(model);
    if (modelStructureSigRef.current === sig) return;
    modelStructureSigRef.current = sig;

    setSelectedRole(null);
    setOnboardIdx(0);
    setItemPatches({});
    setInjectedByTab({});
    setCompose(null);
    setDetail(null);

    if (model.flow?.auth?.enabled) {
      setLaunchPhase("auth");
      setOnboarded(false);
      return;
    }

    if (model.flow?.roles?.length) {
      setLaunchPhase("role");
      setOnboarded(Boolean(startPastOnboarding));
      return;
    }

    if (startPastOnboarding) {
      setLaunchPhase("main");
      setOnboarded(true);
      return;
    }
    if (model.onboarding?.length) {
      setLaunchPhase("onboarding");
      setOnboarded(false);
    } else {
      setLaunchPhase("main");
      setOnboarded(true);
    }
  }, [model, startPastOnboarding]);

  function finishAuthSignUp(role: ExpoUserRole | null) {
    const m = previewModel ?? model;
    if (role) {
      setSelectedRole(role);
      setTab("home");
    }
    if (m?.onboarding.length && !startPastOnboarding) {
      setLaunchPhase("onboarding");
      setOnboarded(false);
    } else {
      setOnboarded(true);
      setLaunchPhase("main");
      setTab("home");
    }
  }

  function resetPreviewSession(message: string) {
    const m = previewModel ?? model;
    setSettingsRow(null);
    setSavedIds(new Set());
    setSettingsToggles({});
    setSelectedRole(null);
    setOnboardIdx(0);
    if (m?.flow?.auth?.enabled) {
      setLaunchPhase("auth");
      setOnboarded(false);
    } else if (m?.flow?.roles?.length) {
      setLaunchPhase("role");
      setOnboarded(Boolean(startPastOnboarding));
    } else if (m?.onboarding.length && !startPastOnboarding) {
      setLaunchPhase("onboarding");
      setOnboarded(false);
    } else {
      setLaunchPhase("main");
      setOnboarded(Boolean(startPastOnboarding));
    }
    setTab(m?.tabs[0]?.id ?? "home");
    setToast(message);
  }

  function handleAccountAction(action: "sign_out" | "delete_account") {
    if (action === "sign_out") {
      resetPreviewSession("Signed out");
      return;
    }
    resetPreviewSession("Account deleted (preview)");
  }

  useEffect(() => {
    if (!model) {
      setImagesReady(false);
      setDisplayModel(null);
      imageUrlMapRef.current = {};
      return;
    }
    let cancelled = false;
    const urls = collectModelImageUrls(model);
    const category = model.category ?? "general";
    const urlKey = [...urls].sort().join("\0");
    const prevKey = Object.keys(imageUrlMapRef.current).sort().join("\0");

    if (urlKey === prevKey && Object.keys(imageUrlMapRef.current).length > 0) {
      setDisplayModel(withLegalSettings(applyImageFallbacks(model, imageUrlMapRef.current)));
      setImagesReady(true);
      return;
    }

    setImagesReady(false);
    void preloadImages(urls, category).then((urlMap) => {
      if (cancelled) return;
      imageUrlMapRef.current = urlMap;
      setDisplayModel(withLegalSettings(applyImageFallbacks(model, urlMap)));
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

  function addToCart(item: ExpoListItem) {
    setCartLines((prev) => {
      const hit = prev.find((l) => l.id === item.id);
      if (hit) {
        return prev.map((l) => (l.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          id: item.id,
          title: item.title,
          price: item.meta ?? "$0",
          imageUrl: item.imageUrl,
          qty: 1,
        },
      ];
    });
  }

  function handlePrimaryAction(item: ExpoListItem) {
    if (!previewModel || !ix || editMode) return;
    const actionLabel = (item.primaryAction ?? "").toLowerCase();
    if (/add to cart|buy now/.test(actionLabel)) {
      addToCart(item);
      const cartTab = findTabId(previewModel, /cart|bag/i);
      if (cartTab) setTab(cartTab);
      setToast(`Added ${item.title} to cart`);
      return;
    }
    const outcome = resolveActionOutcome(item, previewModel, ix);
    if (outcome.triggerSave) {
      toggleSave(item);
      return;
    }
    const mergedPatch = outcome.itemPatch
      ? { ...itemPatches[item.id], ...outcome.itemPatch }
      : itemPatches[item.id];
    if (outcome.itemPatch) {
      setItemPatches((p) => ({
        ...p,
        [item.id]: { ...p[item.id], ...outcome.itemPatch },
      }));
    }
    if (outcome.navigateTab) setTab(outcome.navigateTab);
    if (outcome.openCompose) {
      setCompose({
        ...outcome.openCompose,
        sourceItemId: item.id,
        threadId: item.id,
      });
    } else if (outcome.openDetail) {
      setDetail({ ...item, ...mergedPatch });
    }
    if (outcome.toast) setToast(outcome.toast);
  }

  function handleComposeSend(text: string) {
    if (!compose || !previewModel || !ix) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const messagesTab =
      previewModel.previewActions?.messagingTabId ??
      findTabId(previewModel, /message|chat|inbox/i) ??
      findTabId(previewModel, /bell/i);
    const patternId =
      messagesTab && previewModel.tabScreens[messagesTab]?.patternId
        ? previewModel.tabScreens[messagesTab].patternId
        : previewModel.previewPatterns?.tabs[messagesTab ?? ""];

    if (messagesTab && patternId === "inbox-threads") {
      if (compose.threadId) {
        setThreads((prev) => appendThreadMessage(prev, compose.threadId!, trimmed));
        setActiveThreadId(compose.threadId);
      } else {
        setThreads((prev) => {
          const next = createThreadFromCompose(prev, trimmed);
          if (next[0]) setActiveThreadId(next[0].id);
          return next;
        });
      }
      setTab(messagesTab);
    } else if (messagesTab) {
      setInjectedByTab((prev) => ({
        ...prev,
        [messagesTab]: [
          ...(prev[messagesTab] ?? []),
          {
            id: `sent-${Date.now()}`,
            title: "You",
            subtitle: trimmed.length > 48 ? `${trimmed.slice(0, 45)}…` : trimmed,
            meta: "Sent",
            badge: "New",
            imageUrl: imageForCategory(ix.category, 8),
            detailType: "article" as const,
            body: trimmed,
            primaryAction: "Reply",
          },
        ],
      }));
      setTab(messagesTab);
    }
    setCompose(null);
    setToast("Message sent");
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
    const active = viewModel ?? previewModel;
    const first = active?.home.sections[0]?.items[0];
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
        {showWatermark && <AppableWatermark />}
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
  const readyModel = viewModel ?? displayModel;

  return (
    <div className="relative mx-auto w-full">
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
      <PhoneShell alive={alive} className={className}>
        <div className="relative flex h-full flex-col" style={{ background: t.cream, ...fontStyle }}>
          <SurfaceSelectable
            overlay
            editMode={editMode}
            editPick={editPick}
            path="theme.cream"
            label="App background"
            field="background"
            selectedTarget={selectedTarget}
            onSelectTarget={onSelectTarget}
          />
          <div
            className={cn(
              "relative z-[1] flex min-h-0 flex-1 flex-col",
              editMode && editPick === "surface" && onSelectTarget && "pointer-events-none"
            )}
          >
          <StatusBar />

          <div className="relative min-h-0 flex-1 overflow-hidden px-3 pb-0 pt-1">
            <AnimatePresence mode="wait">
              {building && !showLive ? (
                <BuildingSkeleton key="skel" percent={buildPercent ?? 0} accent={t.accent} />
              ) : launchPhase === "auth" &&
                readyModel.flow?.auth?.enabled &&
                readyModel.flow ? (
                <AuthScreen
                  key="auth"
                  projectId={projectId}
                  appName={readyModel.profile.displayName}
                  flow={readyModel.flow}
                  theme={t}
                  onSuccess={finishAuthSignUp}
                />
              ) : launchPhase === "role" && readyModel.flow?.roles?.length ? (
                <RoleSelectScreen
                  key="role"
                  flow={readyModel.flow}
                  theme={t}
                  appName={readyModel.profile.displayName}
                  editMode={editMode}
          editPick={editPick}
                  selectedTarget={selectedTarget}
                  onSelectTarget={onSelectTarget}
                  onPick={(role) => {
                    if (editMode) return;
                    setSelectedRole(role);
                    setTab("home");
                    if (readyModel.flow?.setupFields?.length) setLaunchPhase("setup");
                    else if (readyModel.onboarding.length && !startPastOnboarding) {
                      setLaunchPhase("onboarding");
                    } else {
                      setOnboarded(true);
                      setLaunchPhase("main");
                    }
                  }}
                />
              ) : launchPhase === "setup" && readyModel.flow?.setupFields?.length ? (
                <SetupWizardScreen
                  key="setup"
                  flow={readyModel.flow}
                  theme={t}
                  roleLabel={selectedRole?.label}
                  editMode={editMode}
          editPick={editPick}
                  selectedTarget={selectedTarget}
                  onSelectTarget={onSelectTarget}
                  onDone={() => {
                    if (editMode) return;
                    if (readyModel.onboarding.length && !startPastOnboarding) {
                      setLaunchPhase("onboarding");
                    } else {
                      confetti({
                        particleCount: 40,
                        spread: 60,
                        origin: { y: 0.7 },
                        colors: [t.accent, t.cream, "#fff"],
                      });
                      setOnboarded(true);
                      setLaunchPhase("main");
                      setTab("home");
                    }
                  }}
                />
              ) : !onboarded && readyModel.onboarding.length ? (
                <Onboarding
                  key="ob"
                  model={readyModel}
                  idx={onboardIdx}
                  editMode={editMode}
          editPick={editPick}
                  selectedTarget={selectedTarget}
                  onSelectTarget={onSelectTarget}
                  onNext={() => {
                    if (editMode) return;
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
                      setLaunchPhase("main");
                      setTab("home");
                    }
                  }}
                  onSkip={() => {
                    if (editMode) return;
                    setOnboarded(true);
                    setLaunchPhase("main");
                    setTab("home");
                  }}
                />
              ) : tab === "home" ? (
                viewModel && tokens && !editMode && viewModel.previewPatterns?.home === "home-dashboard" ? (
                  <HomeDashboardPattern
                    key="home"
                    tokens={tokens}
                    headline={viewModel.home.headline}
                    subheadline={viewModel.home.subheadline}
                    heroLabel={viewModel.home.heroLabel}
                    heroSublabel={viewModel.home.heroSublabel}
                    sections={viewModel.home.sections}
                    category={viewModel.category}
                    onOpen={setDetail}
                    onHero={handleHeroAction}
                    onPrimaryAction={handlePrimaryAction}
                    hasScan={canScan}
                    onVoice={canVoice ? () => setVoiceOpen(true) : undefined}
                    scanning={scanBusy}
                    recording={recording}
                  />
                ) : (
                  <HomeScreen
                    key="home"
                    model={readyModel}
                    editMode={editMode}
          editPick={editPick}
                    selectedTarget={selectedTarget}
                    onSelectTarget={onSelectTarget}
                    onOpen={editMode ? () => {} : setDetail}
                    onHero={editMode ? () => {} : handleHeroAction}
                    onPrimaryAction={editMode ? undefined : handlePrimaryAction}
                    hasScan={canScan && !editMode}
                    onVoice={canVoice && !editMode ? () => setVoiceOpen(true) : undefined}
                    scanning={scanBusy}
                    recording={recording}
                  />
                )
              ) : tab === "profile" ? (
                <ProfileScreen
                  key="profile"
                  model={readyModel}
                  editMode={editMode}
          editPick={editPick}
                  selectedTarget={selectedTarget}
                  onSelectTarget={onSelectTarget}
                  savedCount={savedIds.size}
                  savedStatPatterns={ix?.savedStatPatterns}
                  onSetting={editMode ? () => {} : (label) => setSettingsRow(label)}
                />
              ) : viewModel && tokens ? (
                <TabPatternView
                  key={tab}
                  model={viewModel}
                  tokens={tokens}
                  tabId={resolvedTab?.resolvedId ?? tab}
                  threads={threads}
                  onOpenThread={(id) => {
                    setActiveThreadId(id);
                  }}
                  onNewMessage={() => {
                    setCompose({
                      title: "New message",
                      placeholder: "Type your message…",
                      sourceItemId: "new",
                    });
                  }}
                  onOpenItem={editMode ? () => {} : setDetail}
                  onPrimaryAction={editMode ? undefined : handlePrimaryAction}
                  listsTab={ix ? isListsTab(tab, ix) : false}
                  checked={checked}
                  onToggle={(id) => {
                    setChecked((s) => {
                      const n = new Set(s);
                      if (n.has(id)) n.delete(id);
                      else n.add(id);
                      return n;
                    });
                  }}
                  extraItems={tab === collectionTabId ? extraListItems : undefined}
                  cartLines={cartLines}
                  editMode={editMode}
                >
                  <TabScreen
                    screen={resolvedTab?.screen}
                    tabId={resolvedTab?.resolvedId ?? tab}
                    theme={t}
                    editMode={editMode}
          editPick={editPick}
                    selectedTarget={selectedTarget}
                    onSelectTarget={onSelectTarget}
                    checked={checked}
                    onToggle={(id) => {
                      setChecked((s) => {
                        const n = new Set(s);
                        if (n.has(id)) n.delete(id);
                        else n.add(id);
                        return n;
                      });
                    }}
                    onOpen={editMode ? () => {} : setDetail}
                    onPrimaryAction={editMode ? undefined : handlePrimaryAction}
                    extraItems={
                      tab === collectionTabId ? extraListItems : undefined
                    }
                    listsTab={ix ? isListsTab(tab, ix) : false}
                    onShareList={canShare && !editMode ? handleShareList : undefined}
                  />
                </TabPatternView>
              ) : null}
            </AnimatePresence>

            {detail && tokens && !editMode && viewModel?.previewPatterns?.detail === "content-detail" ? (
              <ContentDetailPattern
                tokens={tokens}
                item={detail}
                category={viewModel.category}
                onClose={() => setDetail(null)}
                onListen={canTts ? () => void playTts(recipeListenText(detail)) : undefined}
                listenBusy={ttsBusy}
                onSave={canSave ? () => toggleSave(detail) : undefined}
                isSaved={savedIds.has(detail.id)}
                onAddToList={canAddToCollection ? () => addToCollection(detail) : undefined}
                onShare={canShare ? () => void handleShare(detail) : undefined}
                onPrimaryAction={
                  detail.primaryAction ? () => handlePrimaryAction(detail) : undefined
                }
                collectionLabel={collectionLabel}
              />
            ) : detail ? (
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
                onPrimaryAction={
                  detail.primaryAction && !editMode
                    ? () => handlePrimaryAction(detail)
                    : undefined
                }
                collectionLabel={collectionLabel}
              />
            ) : null}
            {compose && tokens && (
              <PreviewComposeSheet
                tokens={tokens}
                title={compose.title}
                placeholder={compose.placeholder}
                onClose={() => setCompose(null)}
                onSend={handleComposeSend}
              />
            )}
            {activeThread && tokens && viewModel && (
              <ConversationView
                tokens={tokens}
                thread={activeThread}
                category={viewModel.category}
                onBack={() => setActiveThreadId(null)}
                onReply={() => {
                  setCompose({
                    title: `Reply to ${activeThread.participant}`,
                    placeholder: "Type your message…",
                    sourceItemId: activeThread.id,
                    threadId: activeThread.id,
                  });
                }}
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
                onAccountAction={handleAccountAction}
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

          {launchPhase === "main" && onboarded && imagesReady && (
            <TabBar
              tabs={readyModel.tabs}
              active={tab}
              theme={t}
              editMode={editMode}
          editPick={editPick}
              selectedTarget={selectedTarget}
              onSelectTarget={onSelectTarget}
              onSelect={editMode ? () => {} : setTab}
            />
          )}
          {editMode && !hideEditBanner && (
            <div className="pointer-events-none absolute inset-x-2 top-8 z-30 rounded-lg bg-coral/90 px-2 py-1 text-center text-[9px] font-bold text-white">
              {editModeHint}
            </div>
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

          {showWatermark && <AppableWatermark />}
          </div>
        </div>
      </PhoneShell>

      {!building && showLive && !editMode && (
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

function AppableWatermark() {
  return (
    <a
      href="https://appable.app"
      target="_blank"
      rel="noopener noreferrer"
      className="pointer-events-auto absolute bottom-[3.75rem] right-3 z-30 rounded-full bg-charcoal/55 px-2 py-0.5 text-[8px] font-semibold tracking-wide text-white/90 backdrop-blur-sm transition hover:bg-charcoal/70"
      aria-label="Made with Appable"
    >
      Made with Appable
    </a>
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
    <DeviceMockup className={className} alive={alive}>
      {children}
    </DeviceMockup>
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

function StatusBar({ dark = false }: { dark?: boolean }) {
  const ink = dark ? "text-white/85" : "text-charcoal/75";
  const icon = dark ? "bg-white/70" : "bg-charcoal/45";
  const batt = dark
    ? "border-white/40 bg-white/20"
    : "border-charcoal/35 bg-charcoal/15";
  return (
    <div className="flex shrink-0 items-center justify-between px-4 pb-0.5 pt-[11px]">
      <span className={`text-[10px] font-semibold tabular-nums ${ink}`}>9:41</span>
      <span className="w-[72px]" aria-hidden />
      <div className="flex items-center gap-[4px]">
        <span className={`h-[5px] w-[5px] rounded-full ${icon}`} />
        <span className={`h-[7px] w-[12px] rounded-[2px] ${icon}`} />
        <span className={`h-[9px] w-[15px] rounded-[2px] border ${batt}`} />
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

/** Tabs/roles/onboarding shape — tap-to-fix text edits must not reset preview navigation. */
function modelStructureSignature(model: ExpoAppModel): string {
  return JSON.stringify({
    auth: Boolean(model.flow?.auth?.enabled),
    roles: model.flow?.roles?.map((r) => r.id) ?? [],
    setupLen: model.flow?.setupFields?.length ?? 0,
    onboardingLen: model.onboarding?.length ?? 0,
    tabIds: model.tabs.map((tab) => tab.id),
  });
}

function RoleSelectScreen({
  flow,
  theme,
  appName,
  editMode,
  editPick,
  selectedTarget,
  onSelectTarget,
  onPick,
}: FixEditProps & {
  flow: ExpoAppFlow;
  theme: ExpoAppModel["theme"];
  appName: string;
  onPick: (role: ExpoUserRole) => void;
}) {
  const t = theme;
  const roles = flow.roles ?? [];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col justify-center py-2"
    >
      <Selectable
        editMode={editMode}
          editPick={editPick}
        selectedTarget={selectedTarget}
        onSelectTarget={onSelectTarget}
        path="flow.welcomeTitle"
        label="Welcome title"
        field="title"
        surface={SURFACE.charcoal("Welcome title")}
        className="text-center"
      >
        <p className="text-[13px] font-extrabold" style={{ color: t.charcoal }}>
          {flow.welcomeTitle ?? `Welcome to ${appName}`}
        </p>
      </Selectable>
      <Selectable
        editMode={editMode}
          editPick={editPick}
        selectedTarget={selectedTarget}
        onSelectTarget={onSelectTarget}
        path="flow.welcomeSubtitle"
        label="Welcome subtitle"
        field="subtitle"
        surface={SURFACE.muted("Welcome subtitle")}
        className="mt-1 text-center"
      >
        <p className="text-[10px] leading-snug" style={{ color: t.muted }}>
          {flow.welcomeSubtitle ?? "How will you use the app?"}
        </p>
      </Selectable>
      <div className="mt-4 space-y-2">
        {roles.map((role, index) => {
          const cardInner = (
            <>
              <Selectable
                editMode={editMode}
                editPick={editPick}
                media
                selectedTarget={selectedTarget}
                onSelectTarget={onSelectTarget}
                path={`flow.roles[${index}].emoji`}
                label={`${role.label} icon`}
                field="icon"
                className="shrink-0"
              >
                <span
                  className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl text-lg"
                  style={{ background: `${t.accent}14` }}
                >
                  <RoleIcon value={role.emoji ?? "✦"} />
                </span>
              </Selectable>
              <span className="min-w-0 flex-1">
                <Selectable
                  editMode={editMode}
                  editPick={editPick}
                  selectedTarget={selectedTarget}
                  onSelectTarget={onSelectTarget}
                  path={`flow.roles[${index}].label`}
                  label={role.label}
                  field="role label"
                  surface={SURFACE.charcoal(role.label)}
                  block
                >
                  <span className="block text-[11px] font-bold" style={{ color: t.charcoal }}>
                    {role.label}
                  </span>
                </Selectable>
                <Selectable
                  editMode={editMode}
                  editPick={editPick}
                  selectedTarget={selectedTarget}
                  onSelectTarget={onSelectTarget}
                  path={`flow.roles[${index}].description`}
                  label={role.label}
                  field="description"
                  surface={SURFACE.muted(`${role.label} description`)}
                  block
                  className="mt-0.5"
                >
                  <span className="block text-[9px] leading-snug" style={{ color: t.muted }}>
                    {role.description}
                  </span>
                </Selectable>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: t.muted }} />
            </>
          );

          if (editMode) {
            return (
              <div
                key={role.id}
                className="relative flex w-full items-center gap-3 rounded-2xl border p-3 text-left shadow-sm"
                style={{ borderColor: t.line, background: "#fff" }}
              >
                <SurfaceSelectable
                  overlay
                  editMode={editMode}
                  editPick={editPick}
                  path="theme.card"
                  label={`${role.label} card`}
                  field="card background"
                  selectedTarget={selectedTarget}
                  onSelectTarget={onSelectTarget}
                />
                <div className="relative z-[1] flex w-full items-center gap-3">{cardInner}</div>
              </div>
            );
          }

          return (
            <motion.button
              key={role.id}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onPick(role)}
              className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left shadow-sm"
              style={{ borderColor: t.line, background: "#fff" }}
            >
              {cardInner}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

function AuthScreen({
  projectId,
  appName,
  flow,
  theme,
  onSuccess,
}: {
  projectId?: string;
  appName: string;
  flow: ExpoAppFlow;
  theme: ExpoAppModel["theme"];
  onSuccess: (role: ExpoUserRole | null) => void;
}) {
  const rawAuth = flow.auth!;
  const auth = completeAuthFlow(rawAuth, appName);
  const t = theme;
  const roles = flow.roles ?? [];
  const [mode, setMode] = useState<"signUp" | "signIn">("signUp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === "signUp";
  const showGoogle = auth.showGoogleSignIn !== false;
  const showApple = auth.showAppleSignIn !== false;
  const showOAuth = showGoogle || showApple;

  const canSubmit =
    email.trim().includes("@") &&
    password.length >= 6 &&
    (!isSignUp || !auth.captureName || name.trim().length > 0) &&
    (!isSignUp || !auth.captureRoleInSignUp || roleId);

  function pickRoleAfterAuth(): ExpoUserRole | null {
    if (!isSignUp) return null;
    const picked = roles.find((r) => r.id === roleId) ?? null;
    return auth.captureRoleInSignUp ? picked : null;
  }

  function requireRoleForOAuth(): boolean {
    if (!isSignUp || !auth.captureRoleInSignUp || roleId) return true;
    setError("Pick owner or walker first, then continue with Google or Apple.");
    return false;
  }

  async function oauthSignIn(provider: "google" | "apple") {
    if (!requireRoleForOAuth()) return;
    setBusy(true);
    setError(null);
    try {
      if (auth.liveSupabase && projectId) {
        const cfgRes = await fetch(`/api/projects/${projectId}/supabase-public`);
        if (!cfgRes.ok) {
          throw new Error("Link Supabase in Connections first.");
        }
        const cfg = (await cfgRes.json()) as { url: string; anonKey: string };
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(cfg.url, cfg.anonKey);
        const { error: oauthErr } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: window.location.href },
        });
        if (oauthErr) {
          const msg = oauthErr.message.toLowerCase();
          throw new Error(
            /provider|enabled|not enabled|unsupported/.test(msg)
              ? `Not set up yet — open Connections on the right → Set up ${provider === "google" ? "Google" : "Apple"} login and follow the steps. Email still works for testing.`
              : oauthErr.message
          );
        }
        return;
      }
      onSuccess(pickRoleAfterAuth());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (auth.liveSupabase && projectId) {
        const endpoint = isSignUp ? "preview-signup" : "preview-signin";
        const res = await fetch(`/api/projects/${projectId}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isSignUp
              ? {
                  email: email.trim(),
                  password,
                  displayName: name.trim(),
                  role: auth.captureRoleInSignUp ? roleId : null,
                }
              : { email: email.trim(), password }
          ),
        });
        const payload = (await res.json()) as { error?: string; ok?: boolean };
        if (!res.ok) {
          throw new Error(
            payload.error ??
              (isSignUp ? "Sign-up failed" : "Sign-in failed — check email and password.")
          );
        }
      }
      onSuccess(pickRoleAfterAuth());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isSignUp
            ? "Sign-up failed — try again."
            : "Sign-in failed — try again."
      );
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-xl border px-2.5 py-2 text-[10px] outline-none focus:ring-2 focus:ring-coral/25";
  const inputStyle = {
    borderColor: t.line,
    background: "#fff",
    color: t.charcoal,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col overflow-y-auto pb-2"
    >
      <div
        className="flex rounded-xl border p-0.5"
        style={{ borderColor: t.line, background: `${t.line}40` }}
      >
        {(["signUp", "signIn"] as const).map((tab) => {
          const selected = mode === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setMode(tab);
                setError(null);
              }}
              className="flex-1 rounded-lg py-1.5 text-[9px] font-bold transition"
              style={{
                background: selected ? "#fff" : "transparent",
                color: selected ? t.charcoal : t.muted,
                boxShadow: selected ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              {tab === "signUp" ? "Sign up" : "Sign in"}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] font-extrabold" style={{ color: t.charcoal }}>
        {isSignUp ? auth.signUpTitle : auth.signInTitle}
      </p>
      {(isSignUp ? auth.signUpSubtitle : auth.signInSubtitle) && (
        <p className="mt-0.5 text-[9px]" style={{ color: t.muted }}>
          {isSignUp ? auth.signUpSubtitle : auth.signInSubtitle}
        </p>
      )}
      {isSignUp && auth.captureRoleInSignUp && roles.length > 0 && (
        <div className="mt-2">
          <p className="text-[9px] font-semibold" style={{ color: t.charcoal }}>
            I am a… *
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {roles.map((role) => {
              const selected = roleId === role.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setRoleId(role.id)}
                  className="rounded-lg border px-2 py-1 text-[9px] font-semibold transition"
                  style={{
                    borderColor: selected ? t.accent : t.line,
                    background: selected ? `${t.accent}18` : "#fff",
                    color: t.charcoal,
                  }}
                >
                  {role.emoji ? `${role.emoji} ` : ""}
                  {role.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {showOAuth && (
        <div className="mt-3 space-y-1.5">
          {showGoogle && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void oauthSignIn("google")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border py-2 text-[10px] font-bold disabled:opacity-50"
              style={{ borderColor: t.line, background: "#fff", color: t.charcoal }}
            >
              <GoogleLogo className="h-4 w-4" />
              Continue with Google
            </button>
          )}
          {showApple && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void oauthSignIn("apple")}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-[10px] font-bold text-white disabled:opacity-50"
              style={{ background: "#000" }}
            >
              <AppleLogo className="h-4 w-4" fill="#fff" />
              Continue with Apple
            </button>
          )}
          <p className="py-0.5 text-center text-[8px] font-semibold uppercase tracking-wide" style={{ color: t.muted }}>
            or use email
          </p>
        </div>
      )}
      <div className="mt-2 space-y-2">
        <label className="block text-[9px] font-semibold" style={{ color: t.charcoal }}>
          Email *
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            style={inputStyle}
            placeholder="you@email.com"
          />
        </label>
        <label className="block text-[9px] font-semibold" style={{ color: t.charcoal }}>
          Password *
          <input
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            style={inputStyle}
            placeholder="6+ characters"
          />
        </label>
        {isSignUp && auth.captureName && (
          <label className="block text-[9px] font-semibold" style={{ color: t.charcoal }}>
            Name *
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              style={inputStyle}
              placeholder="Your name"
            />
          </label>
        )}
      </div>
      {error && <p className="mt-2 text-[9px] text-red-600">{error}</p>}
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        disabled={!canSubmit || busy}
        onClick={() => void submit()}
        className="mt-4 w-full rounded-2xl py-2.5 text-[10px] font-bold text-white disabled:opacity-45"
        style={{ background: t.accent }}
      >
        {busy
          ? isSignUp
            ? "Creating account…"
            : "Signing in…"
          : isSignUp
            ? auth.submitLabel
            : auth.signInSubmitLabel}
      </motion.button>
    </motion.div>
  );
}

function SetupWizardScreen({
  flow,
  theme,
  roleLabel,
  editMode,
  editPick,
  selectedTarget,
  onSelectTarget,
  onDone,
}: FixEditProps & {
  flow: ExpoAppFlow;
  theme: ExpoAppModel["theme"];
  roleLabel?: string;
  onDone: () => void;
}) {
  const t = theme;
  const fields = flow.setupFields ?? [];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.id, ""]))
  );

  const setField = (id: string, value: string) => {
    setValues((prev) => ({ ...prev, [id]: value }));
  };

  const requiredOk = fields.every(
    (f) => !f.required || (values[f.id]?.trim().length ?? 0) > 0
  );

  let lastSection = "";

  const inputClass =
    "mt-1 w-full rounded-xl border px-2.5 py-2 text-[10px] outline-none focus:ring-2 focus:ring-coral/25";
  const inputStyle = {
    borderColor: t.line,
    background: "#fff",
    color: t.charcoal,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col overflow-y-auto pb-2"
    >
      <Selectable
        editMode={editMode}
          editPick={editPick}
        selectedTarget={selectedTarget}
        onSelectTarget={onSelectTarget}
        path="flow.setupTitle"
        label="Setup title"
        field="title"
      >
        <p className="text-[12px] font-extrabold" style={{ color: t.charcoal }}>
          {flow.setupTitle ?? "Tell us about you"}
        </p>
      </Selectable>
      <Selectable
        editMode={editMode}
          editPick={editPick}
        selectedTarget={selectedTarget}
        onSelectTarget={onSelectTarget}
        path="flow.setupSubtitle"
        label="Setup subtitle"
        field="subtitle"
        className="mt-0.5"
      >
        <p className="text-[9px]" style={{ color: t.muted }}>
          {flow.setupSubtitle ?? (roleLabel ? `Setting up as ${roleLabel}` : "Quick profile setup")}
        </p>
      </Selectable>
      <div className="mt-3 space-y-2.5">
        {fields.map((field) => {
          const section = field.section;
          const showSection = section && section !== lastSection;
          if (showSection) lastSection = section;
          const value = values[field.id] ?? "";
          return (
            <div key={field.id}>
              {showSection && (
                <p className="mb-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: t.muted }}>
                  {section}
                </p>
              )}
              <label
                htmlFor={`setup-${field.id}`}
                className="block text-[9px] font-semibold"
                style={{ color: t.charcoal }}
              >
                {field.label}
                {field.required ? " *" : ""}
              </label>
              {field.kind === "select" && field.options ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {field.options.map((opt) => {
                    const selected = value === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setField(field.id, opt)}
                        className="rounded-lg border px-2 py-1 text-[9px] font-semibold transition"
                        style={{
                          borderColor: selected ? t.accent : t.line,
                          background: selected ? `${t.accent}18` : "#fff",
                          color: t.charcoal,
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : field.kind === "textarea" ? (
                <textarea
                  id={`setup-${field.id}`}
                  rows={3}
                  value={value}
                  placeholder={field.placeholder}
                  onChange={(e) => setField(field.id, e.target.value)}
                  className={`${inputClass} min-h-[4.5rem] resize-none`}
                  style={inputStyle}
                />
              ) : (
                <input
                  id={`setup-${field.id}`}
                  type="text"
                  value={value}
                  placeholder={field.placeholder ?? field.label}
                  onChange={(e) => setField(field.id, e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
              )}
            </div>
          );
        })}
      </div>
      <Selectable
        editMode={editMode}
        editPick={editPick}
        selectedTarget={selectedTarget}
        onSelectTarget={onSelectTarget}
        path="flow.setupTitle"
        label="Get started button"
        field="button"
        surface={SURFACE.accent("Get started button")}
        block
        className="mt-4"
      >
        <motion.button
          type="button"
          whileTap={editMode ? undefined : { scale: 0.97 }}
          disabled={!editMode && !requiredOk}
          onClick={() => {
            if (editMode) return;
            onDone();
          }}
          className="w-full rounded-2xl py-2.5 text-[10px] font-bold text-white disabled:opacity-45"
          style={{ background: t.accent }}
        >
          Get Started →
        </motion.button>
      </Selectable>
    </motion.div>
  );
}

function Onboarding({
  model,
  idx,
  onNext,
  onSkip,
  editMode,
  editPick,
  selectedTarget,
  onSelectTarget,
}: FixEditProps & {
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
        <Selectable
          editMode={editMode}
          editPick={editPick}
          media
          path={`onboarding[${idx}].imageUrl`}
          label="Onboarding image"
          field="image"
          selectedTarget={selectedTarget}
          onSelectTarget={onSelectTarget}
          block
          className="absolute inset-0 z-[2]"
        >
          <CoverImage
            src={slide.imageUrl}
            category={model.category}
            className="h-full w-full object-cover"
          />
        </Selectable>
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
      <Selectable
        editMode={editMode}
          editPick={editPick}
        selectedTarget={selectedTarget}
        onSelectTarget={onSelectTarget}
        path={`onboarding[${idx}].title`}
        label="Onboarding title"
        field="title"
        surface={SURFACE.charcoal("Onboarding title")}
      >
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="text-[13px] font-extrabold leading-tight"
          style={{ color: t.charcoal }}
        >
          {slide.title}
        </motion.p>
      </Selectable>
      <Selectable
        editMode={editMode}
          editPick={editPick}
        selectedTarget={selectedTarget}
        onSelectTarget={onSelectTarget}
        path={`onboarding[${idx}].subtitle`}
        label="Onboarding subtitle"
        field="subtitle"
        surface={SURFACE.muted("Onboarding subtitle")}
        className="mt-1 flex-1"
      >
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="text-[9px] leading-snug"
          style={{ color: t.muted }}
        >
          {slide.subtitle}
        </motion.p>
      </Selectable>
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
      <Selectable
        editMode={editMode}
          editPick={editPick}
        selectedTarget={selectedTarget}
        onSelectTarget={onSelectTarget}
        path={`onboarding[${idx}].ctaLabel`}
        label="Onboarding button"
        field="button"
        surface={SURFACE.accent("Onboarding button")}
        block
      >
        <motion.button
          type="button"
          whileTap={editMode ? undefined : { scale: 0.97 }}
          onClick={() => {
            if (editMode) return;
            onNext();
          }}
          className="w-full rounded-2xl py-2.5 text-[10px] font-bold text-white shadow-soft"
          style={{
            background: `linear-gradient(135deg, ${t.accent} 0%, ${t.charcoal} 140%)`,
          }}
        >
          {cta}
        </motion.button>
      </Selectable>
      {!isLast && (
        <button
          type="button"
          onClick={() => {
            if (editMode) return;
            onSkip();
          }}
          className="mt-1.5 text-center text-[9px] font-semibold"
          style={{ color: t.muted }}
        >
          Skip
        </button>
      )}
    </motion.div>
  );
}

function Selectable({
  editMode,
  editPick,
  path,
  label,
  field,
  surface,
  content = true,
  media = false,
  selectedTarget,
  onSelectTarget,
  children,
  className,
  style,
  block,
}: FixEditProps & {
  path: string;
  label: string;
  field: string;
  /** When Colors mode is on, tap selects this color token instead of copy. */
  surface?: PickSurface;
  /** When false, only the color chip is tappable (e.g. icon tint). */
  content?: boolean;
  /** Icon or image — tappable in both Text and Colors modes. */
  media?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Full-width tap target — use for buttons, cards, tab cells, settings rows */
  block?: boolean;
}) {
  if (!editMode || !onSelectTarget) return <>{children}</>;

  const isSurface = editPick === "surface" && !media;
  if (isSurface && !surface) return <>{children}</>;
  if (!isSurface && !content && !media) return <>{children}</>;

  const target = isSurface
    ? { path: surface!.path, label: surface!.label, field: surface!.field }
    : { path, label, field };

  const selected = isTargetSelected(selectedTarget, target);
  const pick = (e: { stopPropagation: () => void; preventDefault: () => void }) => {
    e.stopPropagation();
    e.preventDefault();
    onSelectTarget(target);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={pick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") pick(e);
      }}
      style={style}
      className={cn(
        className,
        block && "block w-full cursor-pointer",
        "pointer-events-auto relative z-[2] touch-manipulation rounded-xl transition",
        selected
          ? "border-2 border-coral shadow-[0_0_0_2px_rgba(255,122,99,0.15)]"
          : "border-2 border-transparent hover:border-coral/35 active:border-coral/50"
      )}
    >
      {selected && <SelectionMarker />}
      {children}
    </div>
  );
}

function HomeScreen({
  model,
  onOpen,
  onHero,
  onPrimaryAction,
  hasScan,
  onVoice,
  scanning,
  recording,
  editMode,
  editPick,
  selectedTarget,
  onSelectTarget,
}: FixEditProps & {
  model: ExpoAppModel;
  onOpen: (item: ExpoListItem) => void;
  onHero: () => void;
  onPrimaryAction?: (item: ExpoListItem) => void;
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
      <Selectable
        editMode={editMode}
          editPick={editPick}
        path="home.headline"
        label="Home headline"
        field="Headline"
        surface={SURFACE.charcoal("Home headline")}
        selectedTarget={selectedTarget}
        onSelectTarget={onSelectTarget}
        block
        className="py-0.5"
      >
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
      </Selectable>
      <Selectable
        editMode={editMode}
          editPick={editPick}
        path="home.subheadline"
        label="Home subheadline"
        field="Subheadline"
        surface={SURFACE.muted("Home subheadline")}
        selectedTarget={selectedTarget}
        onSelectTarget={onSelectTarget}
        block
        className="mt-0.5 py-0.5"
      >
        <motion.p
          variants={fadeUp}
          custom={1}
          initial="hidden"
          animate="show"
          className="text-[10px] leading-snug"
          style={{ color: t.muted }}
        >
          {h.subheadline}
        </motion.p>
      </Selectable>

      <Selectable
        editMode={editMode}
        editPick={editPick}
        path="home.heroLabel"
        label="Main button"
        field="Hero button"
        surface={SURFACE.accent("Main button")}
        selectedTarget={selectedTarget}
        onSelectTarget={onSelectTarget}
        block
        className="mt-2.5"
      >
        <motion.div
          variants={fadeUp}
          custom={2}
          initial="hidden"
          animate="show"
          className={cn(
            "flex w-full items-center gap-2 rounded-2xl p-2.5 text-left shadow-soft",
            !editMode && "cursor-pointer"
          )}
          style={{ background: t.accent }}
          {...(!editMode
            ? {
                role: "button" as const,
                tabIndex: 0,
                onClick: onHero,
                onKeyDown: (e: KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") onHero();
                },
              }
            : {})}
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
        </motion.div>
      </Selectable>

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
          <Selectable
            editMode={editMode}
          editPick={editPick}
            path={`home.sections[${si}].title`}
            label={sec.title}
            field="Section title"
            selectedTarget={selectedTarget}
            onSelectTarget={onSelectTarget}
            block
            className="mb-1.5"
          >
            <p
              className="text-[10px] font-bold uppercase tracking-wide"
              style={{ color: t.muted }}
            >
              {sec.title}
            </p>
          </Selectable>
          <div className="space-y-1.5">
            {sec.items.map((item, i) => (
              <ItemCard
                key={item.id}
                item={item}
                itemPath={`home.sections[${si}].items[${i}]`}
                theme={t}
                index={si * 3 + i + 3}
                editMode={editMode}
          editPick={editPick}
                selectedTarget={selectedTarget}
                onSelectTarget={onSelectTarget}
                onOpen={() => onOpen(item)}
                onPrimaryAction={onPrimaryAction}
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
  onPrimaryAction,
  listsTab,
  extraItems,
  onShareList,
  editMode,
  editPick,
  selectedTarget,
  onSelectTarget,
}: FixEditProps & {
  screen: ExpoAppModel["tabScreens"][string] | undefined;
  tabId: string;
  theme: ExpoAppModel["theme"];
  checked: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (item: ExpoListItem) => void;
  onPrimaryAction?: (item: ExpoListItem) => void;
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
          <Selectable
            editMode={editMode}
          editPick={editPick}
            path={`tabScreens.${tabId}.title`}
            label={`${tabId} tab title`}
            field="Tab title"
            selectedTarget={selectedTarget}
            onSelectTarget={onSelectTarget}
            block
            className="py-0.5"
          >
            <p className="text-[12px] font-extrabold" style={{ color: t.charcoal }}>
              {screen.title}
            </p>
          </Selectable>
          <Selectable
            editMode={editMode}
          editPick={editPick}
            path={`tabScreens.${tabId}.subtitle`}
            label={`${tabId} tab subtitle`}
            field="Tab subtitle"
            selectedTarget={selectedTarget}
            onSelectTarget={onSelectTarget}
            block
            className="py-0.5"
          >
            <p className="text-[10px]" style={{ color: t.muted }}>
              {screen.subtitle}
            </p>
          </Selectable>
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
        {screen.items.map((item, i) =>
          listsTab ? (
            editMode && onSelectTarget ? (
              <Selectable
                key={item.id}
                editMode={editMode}
          editPick={editPick}
                path={`tabScreens.${tabId}.items[${i}].title`}
                label={item.title}
                field="List item"
                surface={SURFACE.card(item.title)}
                selectedTarget={selectedTarget}
                onSelectTarget={onSelectTarget}
                block
                className="rounded-xl border p-2"
                style={{ borderColor: t.line, background: t.card }}
              >
                <div className="flex w-full items-center gap-2">
                <span
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-md border"
                  style={{
                    borderColor: checked.has(item.id) ? t.accent : t.line,
                    background: checked.has(item.id) ? t.accent : "transparent",
                  }}
                >
                  {checked.has(item.id) && <Check className="h-2.5 w-2.5 text-white" />}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-[10px] font-bold" style={{ color: t.charcoal }}>
                    {item.title}
                  </span>
                  <span className="block text-[9px]" style={{ color: t.muted }}>
                    {item.subtitle}
                  </span>
                </span>
                </div>
              </Selectable>
            ) : (
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
            )
          ) : (
            <ItemCard
              key={item.id}
              item={item}
              itemPath={`tabScreens.${tabId}.items[${i}]`}
              theme={t}
              index={i}
              editMode={editMode}
          editPick={editPick}
              selectedTarget={selectedTarget}
              onSelectTarget={onSelectTarget}
              onOpen={() => onOpen(item)}
              onPrimaryAction={onPrimaryAction}
            />
          )
        )}
        {(extraItems ?? []).map((item, i) => (
          <ItemCard
            key={item.id}
            item={item}
            itemPath={`tabScreens.${tabId}.items[${screen.items.length + i}]`}
            theme={t}
            index={screen.items.length + i}
            editMode={editMode}
          editPick={editPick}
            selectedTarget={selectedTarget}
            onSelectTarget={onSelectTarget}
            onOpen={() => onOpen(item)}
            onPrimaryAction={onPrimaryAction}
          />
        ))}
      </div>
    </div>
  );
}

function ItemCard({
  item,
  itemPath,
  theme,
  index,
  onOpen,
  onPrimaryAction,
  editMode,
  editPick,
  selectedTarget,
  onSelectTarget,
}: FixEditProps & {
  item: ExpoListItem;
  itemPath?: string;
  theme: { accent: string; charcoal: string; muted: string; line: string; card: string };
  index: number;
  onOpen: () => void;
  onPrimaryAction?: (item: ExpoListItem) => void;
}) {
  const base = itemPath ?? "";
  const cardLabel = item.title || "Card";
  const canFix = Boolean(editMode && itemPath && onSelectTarget);

  const tagsRow = (
    <span className="flex flex-wrap items-center gap-1">
      {(item.tags ?? []).map((tag) => (
        <span
          key={tag}
          className="rounded-md px-1 py-0.5 text-[7px] font-bold"
          style={{ background: `${theme.accent}14`, color: theme.accent }}
        >
          {tag}
        </span>
      ))}
      {item.badge && (
        <span
          className="rounded-md px-1 py-0.5 text-[7px] font-bold uppercase"
          style={{ background: `${theme.accent}18`, color: theme.accent }}
        >
          {item.badge}
        </span>
      )}
    </span>
  );

  const cardBody = (
    <>
      <CoverImage
        src={item.imageUrl}
        fallbackIndex={index}
        className="h-11 w-11 shrink-0 rounded-xl object-cover"
      />
      <span className="min-w-0 flex-1 py-0.5">
        {tagsRow}
        <span className="mt-0.5 block text-[10px] font-bold leading-tight" style={{ color: theme.charcoal }}>
          {item.title}
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
    </>
  );

  return (
    <SurfaceSelectable
      editMode={editMode}
      editPick={editPick}
      path="theme.card"
      label={`${cardLabel} card`}
      field="card background"
      selectedTarget={selectedTarget}
      onSelectTarget={onSelectTarget}
      block
    >
      <motion.div
        variants={fadeUp}
        custom={index}
        initial="hidden"
        animate="show"
        className="overflow-hidden rounded-2xl border text-left shadow-sm"
        style={{ borderColor: theme.line, background: theme.card }}
      >
      {canFix ? (
        <div className="p-2">
          <div className="flex w-full gap-2 text-left py-1">
            <Selectable
              editMode={editMode}
              editPick={editPick}
              media
              path={`${base}.imageUrl`}
              label={cardLabel}
              field="image"
              selectedTarget={selectedTarget}
              onSelectTarget={onSelectTarget}
              className="shrink-0"
            >
              <CoverImage
                src={item.imageUrl}
                fallbackIndex={index}
                className="h-11 w-11 rounded-xl object-cover"
              />
            </Selectable>
            <Selectable
              editMode={editMode}
              editPick={editPick}
              path={`${base}.title`}
              label={cardLabel}
              field="Card title"
              surface={SURFACE.charcoal(`${cardLabel} title`)}
              selectedTarget={selectedTarget}
              onSelectTarget={onSelectTarget}
              block
              className="min-w-0 flex-1 py-0.5"
            >
              {tagsRow}
              <span className="mt-0.5 block text-[10px] font-bold leading-tight" style={{ color: theme.charcoal }}>
                {item.title}
              </span>
            </Selectable>
          </div>
          <Selectable
            editMode={editMode}
          editPick={editPick}
            path={`${base}.subtitle`}
            label={cardLabel}
            field="Card subtitle"
            surface={SURFACE.muted(`${cardLabel} subtitle`)}
            selectedTarget={selectedTarget}
            onSelectTarget={onSelectTarget}
            block
            className="mt-1 py-1 pl-[3.25rem]"
          >
            <span className="block text-[9px] leading-snug" style={{ color: theme.muted }}>
              {item.subtitle}
            </span>
            {item.meta && (
              <span className="mt-0.5 block text-[8px] font-semibold" style={{ color: theme.accent }}>
                {item.meta}
              </span>
            )}
          </Selectable>
        </div>
      ) : (
        <button type="button" onClick={onOpen} className="flex w-full gap-2 p-2 text-left">
          {cardBody}
        </button>
      )}
      {item.quote && (
        <Selectable
          editMode={canFix}
          editPick={editPick}
          path={`${base}.quote`}
          label={cardLabel}
          field="Quote"
          selectedTarget={selectedTarget}
          onSelectTarget={onSelectTarget}
          block
          className="mx-2 mb-2"
        >
          <p
            className="rounded-lg border-l-2 px-2 py-1 text-[8px] italic leading-snug"
            style={{ borderColor: theme.accent, color: theme.muted, background: theme.card }}
          >
            {item.quote}
          </p>
        </Selectable>
      )}
      {item.primaryAction &&
        (canFix ? (
          <Selectable
            editMode={editMode}
          editPick={editPick}
            path={`${base}.primaryAction`}
            label={cardLabel}
            field="Button label"
            surface={SURFACE.accent(`${cardLabel} button`)}
            selectedTarget={selectedTarget}
            onSelectTarget={onSelectTarget}
            block
            className="mx-2 mb-2"
          >
            <div
              className="w-full rounded-xl py-2.5 text-center text-[9px] font-bold text-white"
              style={{ background: theme.accent }}
            >
              {item.primaryAction}
            </div>
          </Selectable>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onPrimaryAction) onPrimaryAction(item);
              else onOpen();
            }}
            className="mx-2 mb-2 w-[calc(100%-1rem)] rounded-xl py-2 text-[9px] font-bold text-white"
            style={{ background: theme.accent }}
          >
            {item.primaryAction}
          </button>
        ))}
      </motion.div>
    </SurfaceSelectable>
  );
}

function ProfileScreen({
  model,
  savedCount,
  savedStatPatterns,
  onSetting,
  editMode,
  editPick,
  selectedTarget,
  onSelectTarget,
}: FixEditProps & {
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
        <Selectable
          editMode={editMode}
          editPick={editPick}
          path="profile.displayName"
          label="Profile avatar"
          field="avatar"
          surface={SURFACE.accent("Profile avatar")}
          selectedTarget={selectedTarget}
          onSelectTarget={onSelectTarget}
        >
          <span
            className="grid h-10 w-10 place-items-center rounded-2xl text-sm font-bold text-white"
            style={{ background: t.accent }}
          >
            {p.displayName.charAt(0)}
          </span>
        </Selectable>
        <div>
          <Selectable
            editMode={editMode}
          editPick={editPick}
            path="profile.displayName"
            label="Profile name"
            field="Display name"
            selectedTarget={selectedTarget}
            onSelectTarget={onSelectTarget}
          >
            <p className="text-[11px] font-extrabold" style={{ color: t.charcoal }}>
              {p.displayName}
            </p>
          </Selectable>
          <Selectable
            editMode={editMode}
          editPick={editPick}
            path="profile.tagline"
            label="Profile tagline"
            field="Tagline"
            selectedTarget={selectedTarget}
            onSelectTarget={onSelectTarget}
          >
            <p className="text-[9px]" style={{ color: t.muted }}>
              {p.tagline}
            </p>
          </Selectable>
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
        {p.settings.map((row, ri) => {
          const Icon = ICONS[row.icon] ?? Settings;
          const rowInner = (
            <>
              <Icon className="h-3.5 w-3.5" style={{ color: t.accent }} />
              <span className="flex-1 text-[10px] font-semibold" style={{ color: t.charcoal }}>
                {row.label}
              </span>
              <ChevronRight className="h-3 w-3" style={{ color: t.muted }} />
            </>
          );
          if (editMode && onSelectTarget) {
            return (
              <Selectable
                key={row.label}
                editMode={editMode}
          editPick={editPick}
                path={`profile.settings[${ri}].label`}
                label={row.label}
                field="Settings row"
                surface={SURFACE.card(row.label)}
                selectedTarget={selectedTarget}
                onSelectTarget={onSelectTarget}
                block
                className="rounded-xl border px-2 py-2.5"
                style={{ borderColor: t.line, background: t.card }}
              >
                <div className="flex w-full items-center gap-2 text-left">{rowInner}</div>
              </Selectable>
            );
          }
          return (
            <button
              key={row.label}
              type="button"
              onClick={() => onSetting(row.label)}
              className="flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left transition active:scale-[0.98]"
              style={{ borderColor: t.line, background: t.card }}
            >
              {rowInner}
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
  editMode,
  editPick,
  selectedTarget,
  onSelectTarget,
}: FixEditProps & {
  tabs: ExpoAppModel["tabs"];
  active: string;
  theme: ExpoAppModel["theme"];
  onSelect: (id: string) => void;
}) {
  return (
    <SurfaceSelectable
      editMode={editMode}
      editPick={editPick}
      path="theme.card"
      label="Tab bar"
      field="bar background"
      selectedTarget={selectedTarget}
      onSelectTarget={onSelectTarget}
      className="flex shrink-0 border-t px-0.5 py-1"
      style={{ borderColor: theme.line, background: theme.card }}
    >
      {tabs.map((tab, ti) => {
        const Icon = ICONS[tab.icon] ?? Home;
        const on = active === tab.id;
        const cell = (
          <>
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
          </>
        );
        if (editMode && onSelectTarget) {
          return (
            <Selectable
              key={tab.id}
              editMode={editMode}
          editPick={editPick}
              path={`tabs[${ti}].label`}
              label={`${tab.label} tab`}
              field="Tab label"
              surface={SURFACE.accent(`${tab.label} tab`)}
              selectedTarget={selectedTarget}
              onSelectTarget={onSelectTarget}
              block
              className="flex flex-1 flex-col items-center gap-0.5 py-1.5"
            >
              {cell}
            </Selectable>
          );
        }
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className="flex flex-1 flex-col items-center gap-0.5 py-0.5"
          >
            {cell}
          </button>
        );
      })}
    </SurfaceSelectable>
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
  onAccountAction,
  onClose,
}: {
  label: string;
  theme: ExpoAppModel["theme"];
  binding?: SettingBinding;
  projectId?: string;
  toggled: boolean;
  onToggle: (on: boolean) => void;
  onOpenLegal: (doc: "privacy" | "terms" | "support") => void;
  onAccountAction: (action: "sign_out" | "delete_account") => void;
  onClose: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const kind = binding?.kind ?? "info";
  const legalDoc = binding?.legalDoc;
  const accountAction = binding?.accountAction;
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
        {kind === "account" && accountAction === "sign_out" && (
          <button
            type="button"
            onClick={() => onAccountAction("sign_out")}
            className="mt-3 w-full rounded-xl border py-2 text-[9px] font-bold"
            style={{ borderColor: theme.line, color: theme.charcoal, background: theme.cream }}
          >
            Sign out
          </button>
        )}
        {kind === "account" && accountAction === "delete_account" && (
          <div className="mt-3 space-y-2">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full rounded-xl border border-red-200 py-2 text-[9px] font-bold text-red-700"
                style={{ background: "#fef2f2" }}
              >
                Delete my account
              </button>
            ) : (
              <>
                <p className="text-[9px] font-semibold text-red-800">
                  This removes your account and data. Cannot be undone.
                </p>
                <button
                  type="button"
                  onClick={() => onAccountAction("delete_account")}
                  className="w-full rounded-xl py-2 text-[9px] font-bold text-white"
                  style={{ background: "#dc2626" }}
                >
                  Yes, delete account
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="w-full rounded-xl border py-2 text-[9px] font-bold"
                  style={{ borderColor: theme.line, color: theme.muted, background: theme.cream }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
        {kind !== "account" && (
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-xl py-2 text-[9px] font-bold text-white"
            style={{ background: theme.accent }}
          >
            Done
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

function ComposeSheet({
  title,
  placeholder,
  theme,
  onClose,
  onSend,
}: {
  title: string;
  placeholder: string;
  theme: ExpoAppModel["theme"];
  onClose: () => void;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
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
            {title}
          </p>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" style={{ color: theme.muted }} />
          </button>
        </div>
        <textarea
          autoFocus
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="w-full resize-none rounded-xl border px-2.5 py-2 text-[10px] outline-none focus:ring-2 focus:ring-coral/25"
          style={{
            borderColor: theme.line,
            background: theme.cream,
            color: theme.charcoal,
          }}
        />
        <button
          type="button"
          disabled={!draft.trim()}
          onClick={() => onSend(draft)}
          className="mt-2 w-full rounded-xl py-2.5 text-[10px] font-bold text-white disabled:opacity-45"
          style={{ background: theme.accent }}
        >
          Send
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
  onPrimaryAction,
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
  onPrimaryAction?: () => void;
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
        {item.primaryAction && onPrimaryAction && (
          <button
            type="button"
            onClick={onPrimaryAction}
            className="mt-1.5 w-full rounded-xl py-2.5 text-[9px] font-bold text-white"
            style={{ background: theme.accent }}
          >
            {item.primaryAction}
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
