"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  ACCENT_STYLES,
  type ConnectorAccent,
} from "@/lib/connectors/connectorThemes";
import { cn } from "@/lib/utils";

export function ConnectorAccordion({
  id,
  title,
  subtitle,
  icon,
  accent = "default",
  open,
  onToggle,
  connected = false,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  accent?: ConnectorAccent;
  open: boolean;
  onToggle: () => void;
  connected?: boolean;
  children: ReactNode;
}) {
  const theme = ACCENT_STYLES[accent];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border transition-all duration-300",
        open
          ? theme.open
          : "border-line/25 bg-white/95 shadow-[0_2px_10px_-4px_rgba(43,38,36,0.1)] hover:border-line/40 hover:shadow-[0_4px_16px_-6px_rgba(43,38,36,0.12)]"
      )}
    >
      {open && (
        <span
          className={cn("absolute inset-y-0 left-0 w-[3px]", theme.leftBar)}
          aria-hidden
        />
      )}

      <button
        type="button"
        id={`${id}-trigger`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
          open ? cn("pl-4", theme.headerOpen) : "hover:bg-white/80"
        )}
      >
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1",
            theme.icon
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold tracking-tight text-charcoal">
              {title}
            </span>
            {connected && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider",
                  theme.badge
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", theme.dot)} />
                Live
              </span>
            )}
          </span>
          {subtitle && (
            <span className="mt-0.5 block truncate text-[10px] text-warmgrey/90">
              {subtitle}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-warmgrey/80 transition-transform duration-300",
            open && "rotate-180 text-charcoal"
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          id={`${id}-panel`}
          role="region"
          aria-labelledby={`${id}-trigger`}
          className="border-t border-line/15 px-3 pb-3 pt-2"
        >
          <div className="rounded-xl border border-line/20 bg-white/75 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-sm">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
