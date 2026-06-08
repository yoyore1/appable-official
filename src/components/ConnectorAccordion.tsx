"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConnectorAccordion({
  id,
  title,
  subtitle,
  icon,
  open,
  onToggle,
  connected = false,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  connected?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line/35 bg-white/80">
      <button
        type="button"
        id={`${id}-trigger`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2.5 py-2.5 text-left transition hover:bg-white/90"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-charcoal">{title}</span>
            {connected && (
              <span className="rounded-full bg-moss/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-moss">
                Connected
              </span>
            )}
          </span>
          {subtitle && (
            <span className="mt-0.5 block truncate text-[9px] text-warmgrey">{subtitle}</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-warmgrey transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div
          id={`${id}-panel`}
          role="region"
          aria-labelledby={`${id}-trigger`}
          className="space-y-2 border-t border-line/25 px-2.5 pb-2.5 pt-2"
        >
          {children}
        </div>
      )}
    </div>
  );
}
