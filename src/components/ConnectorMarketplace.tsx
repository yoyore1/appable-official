"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Search, Store, X } from "lucide-react";
import {
  CONNECTOR_CATEGORY_LABELS,
  catalogSorted,
  type ConnectorCategory,
  type ConnectorId,
} from "@/lib/connectors/catalog";
import {
  getConnectorDefinition,
  isConnectorConnected,
  type ConnectorRecommendation,
  type ProjectConnectorState,
} from "@/lib/connectors/registry";
import { getConnectorConnectionType } from "@/lib/connectors/sdkCatalog";
import { cn } from "@/lib/utils";

export function ConnectorMarketplace({
  open,
  onClose,
  state,
  selections,
  suggestions,
  onToggleSelection,
  onExplain,
  busyId,
}: {
  open: boolean;
  onClose: () => void;
  state: ProjectConnectorState;
  selections: ConnectorId[];
  suggestions: ConnectorId[];
  onToggleSelection: (id: ConnectorId, selected: boolean) => void;
  onExplain: (id: ConnectorId) => void;
  busyId?: ConnectorId | null;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ConnectorCategory | "all">("all");

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogSorted().filter((def) => {
      if (category !== "all" && def.category !== category) return false;
      if (!q) return true;
      return (
        def.displayName.toLowerCase().includes(q) ||
        def.role.toLowerCase().includes(q) ||
        CONNECTOR_CATEGORY_LABELS[def.category].toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  if (!open) return null;

  const categories = Object.entries(CONNECTOR_CATEGORY_LABELS) as [ConnectorCategory, string][];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-cream shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="connector-marketplace-title"
      >
        <div className="flex items-start justify-between gap-2 border-b border-line/30 px-4 py-3">
          <div>
            <p
              id="connector-marketplace-title"
              className="flex items-center gap-1.5 text-sm font-bold text-charcoal"
            >
              <Store className="h-4 w-4 text-coral" />
              Integration marketplace
            </p>
            <p className="mt-0.5 text-[10px] text-warmgrey">
              Browse and add what you want — nothing connects until you choose.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-warmgrey hover:bg-sand/60"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 border-b border-line/20 px-4 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-warmgrey" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search integrations…"
              className="w-full rounded-lg border border-line/40 bg-white py-2 pl-8 pr-3 text-[11px] outline-none ring-coral/30 focus:ring-2"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            <CategoryChip
              active={category === "all"}
              onClick={() => setCategory("all")}
              label="All"
            />
            {categories.map(([id, label]) => (
              <CategoryChip
                key={id}
                active={category === id}
                onClick={() => setCategory(id)}
                label={label}
              />
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-2">
            {items.map((def) => {
              const full = getConnectorDefinition(def.id);
              const connected = isConnectorConnected(def.id, state);
              const selected = selections.includes(def.id) || connected;
              const suggested = suggestions.includes(def.id);
              const blocked = full.dependsOn?.find(
                (dep) => !isConnectorConnected(dep, state) && !selections.includes(dep)
              );

              return (
                <div
                  key={def.id}
                  className="rounded-xl border border-line/35 bg-white/80 p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-charcoal">{def.displayName}</p>
                      <p className="text-[9px] font-medium text-warmgrey">
                        {CONNECTOR_CATEGORY_LABELS[def.category]}
                        {getConnectorConnectionType(def.id) === "native" ||
                        getConnectorConnectionType(def.id) === "sdk"
                          ? " · Connect in Integrations"
                          : " · Setup coming soon"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {connected && (
                        <span className="rounded-md bg-[#3ECF8E]/15 px-1.5 py-0.5 text-[8px] font-bold text-[#1a7f4e]">
                          Connected
                        </span>
                      )}
                      {suggested && !connected && (
                        <span className="rounded-md bg-coral/10 px-1.5 py-0.5 text-[8px] font-bold text-coral">
                          Suggested
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-snug text-warmgrey">{def.role}</p>
                  {blocked && (
                    <p className="mt-1 text-[9px] text-warmgrey">
                      Often paired with {getConnectorDefinition(blocked).displayName}
                    </p>
                  )}
                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onExplain(def.id)}
                      className="shrink-0 rounded-lg border border-line/50 px-2.5 py-2 text-[10px] font-bold text-charcoal hover:bg-sand/50"
                    >
                      Explain
                    </button>
                    <button
                      type="button"
                      disabled={connected || busyId === def.id}
                      onClick={() => onToggleSelection(def.id, !selected)}
                      className={cn(
                        "flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-bold transition",
                        selected && !connected
                          ? "border border-line/50 bg-sand/40 text-charcoal"
                          : "bg-coral text-white hover:opacity-90 disabled:opacity-50"
                      )}
                    >
                      {connected ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Connected
                        </>
                      ) : selected ? (
                        "Remove from project"
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          Add to project
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[9px] font-semibold transition",
        active ? "bg-charcoal text-white" : "bg-sand/60 text-warmgrey hover:text-charcoal"
      )}
    >
      {label}
    </button>
  );
}

export function marketplaceSuggestionHint(recommendations: ConnectorRecommendation[]): string | null {
  if (!recommendations.length) return null;
  return recommendations
    .slice(0, 2)
    .map((r) => r.displayName)
    .join(", ");
}
