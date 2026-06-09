import type { ConnectorId } from "./catalog";

export type ConnectorAccent =
  | "supabase"
  | "revenuecat"
  | "railway"
  | "posthog"
  | "sentry"
  | "analytics"
  | "default";

const ACCENT_MAP: Partial<Record<ConnectorId, ConnectorAccent>> = {
  supabase: "supabase",
  revenuecat: "revenuecat",
  railway: "railway",
  posthog: "posthog",
  sentry: "sentry",
  branch: "analytics",
  appfollow: "analytics",
  onesignal: "analytics",
  appsflyer: "analytics",
  admob: "analytics",
  superwall: "revenuecat",
  crisp: "default",
  github: "default",
  "eas-build": "default",
  "app-store-connect": "default",
};

export function connectorAccent(id: ConnectorId): ConnectorAccent {
  return ACCENT_MAP[id] ?? "default";
}

export const ACCENT_STYLES: Record<
  ConnectorAccent,
  {
    icon: string;
    open: string;
    headerOpen: string;
    leftBar: string;
    badge: string;
    dot: string;
  }
> = {
  supabase: {
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-200/50",
    open: "border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 via-white to-white shadow-[0_10px_32px_-12px_rgba(16,185,129,0.28)]",
    headerOpen: "bg-emerald-50/40",
    leftBar: "bg-emerald-500",
    badge: "border border-emerald-200/70 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
  },
  revenuecat: {
    icon: "bg-indigo-50 text-indigo-700 ring-indigo-200/50",
    open: "border-indigo-200/70 bg-gradient-to-br from-indigo-50/90 via-white to-white shadow-[0_10px_32px_-12px_rgba(99,102,241,0.25)]",
    headerOpen: "bg-indigo-50/40",
    leftBar: "bg-indigo-500",
    badge: "border border-indigo-200/70 bg-indigo-50 text-indigo-800",
    dot: "bg-indigo-500",
  },
  railway: {
    icon: "bg-slate-900 text-white ring-slate-700/40",
    open: "border-slate-300/80 bg-gradient-to-br from-slate-100/90 via-white to-white shadow-[0_10px_32px_-12px_rgba(15,23,42,0.2)]",
    headerOpen: "bg-slate-100/60",
    leftBar: "bg-slate-800",
    badge: "border border-slate-300/70 bg-slate-100 text-slate-800",
    dot: "bg-slate-700",
  },
  posthog: {
    icon: "bg-orange-50 text-orange-700 ring-orange-200/50",
    open: "border-orange-200/70 bg-gradient-to-br from-orange-50/90 via-white to-white shadow-[0_10px_32px_-12px_rgba(249,115,22,0.22)]",
    headerOpen: "bg-orange-50/40",
    leftBar: "bg-orange-500",
    badge: "border border-orange-200/70 bg-orange-50 text-orange-800",
    dot: "bg-orange-500",
  },
  sentry: {
    icon: "bg-violet-50 text-violet-700 ring-violet-200/50",
    open: "border-violet-200/70 bg-gradient-to-br from-violet-50/90 via-white to-white shadow-[0_10px_32px_-12px_rgba(139,92,246,0.22)]",
    headerOpen: "bg-violet-50/40",
    leftBar: "bg-violet-500",
    badge: "border border-violet-200/70 bg-violet-50 text-violet-800",
    dot: "bg-violet-500",
  },
  analytics: {
    icon: "bg-sky-50 text-sky-700 ring-sky-200/50",
    open: "border-sky-200/70 bg-gradient-to-br from-sky-50/90 via-white to-white shadow-[0_10px_32px_-12px_rgba(14,165,233,0.2)]",
    headerOpen: "bg-sky-50/40",
    leftBar: "bg-sky-500",
    badge: "border border-sky-200/70 bg-sky-50 text-sky-800",
    dot: "bg-sky-500",
  },
  default: {
    icon: "bg-coral/10 text-coral-deep ring-coral/20",
    open: "border-coral/25 bg-gradient-to-br from-coral/[0.07] via-white to-white shadow-[0_10px_32px_-12px_rgba(255,122,99,0.18)]",
    headerOpen: "bg-coral/[0.05]",
    leftBar: "bg-coral",
    badge: "border border-coral/25 bg-coral/10 text-coral-deep",
    dot: "bg-coral",
  },
};
