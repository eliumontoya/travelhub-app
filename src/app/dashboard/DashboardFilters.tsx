"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FilterBadges } from "@/app/dashboard/filters/FilterBadges";
import { FilterCombobox } from "@/app/dashboard/filters/FilterCombobox";
import {
  buildTripFilterSearchParams,
  cleanTripFilters,
  deserializeTripFilters,
} from "@/lib/trip-filters";
import type { Client, Tag, TravelAgent, TripFilters, TripStatus, TripCurrency } from "@/types";

const STATUS_OPTIONS: TripStatus[] = ["draft", "published", "archived"];
const STATUS_LABELS: Record<TripStatus, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};
const CURRENCY_OPTIONS: TripCurrency[] = ["MXN", "USD", "EUR"];

/**
 * Advanced filter bar for the dashboard. Syncs changes to URL via
 * router.replace (debounced 300ms for text, immediate for others) and emits
 * onChange with the current TripFilters. Renders active filter badges with
 * individual remove and a "Clear all" button.
 *
 * Use key={JSON.stringify(initialFilters)} in the parent to force remount
 * when initialFilters change, avoiding useEffect setState-in-effect patterns.
 */
export function DashboardFilters({
  onChange,
  clients,
  tags,
  travelAgents,
}: {
  onChange: (filters: Partial<TripFilters>) => void;
  clients: Client[];
  tags: Tag[];
  travelAgents?: TravelAgent[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Partial<TripFilters>>(() =>
    deserializeTripFilters(searchParams),
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  function syncUrl(f: Partial<TripFilters>) {
    router.replace(
      `?${buildTripFilterSearchParams(new URLSearchParams(searchParams.toString()), f).toString()}`,
      { scroll: false },
    );
  }

  function applyFilters(nextFilters: Partial<TripFilters>, immediateSync: boolean) {
    const next = cleanTripFilters(nextFilters);

    if (immediateSync) {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      syncUrl(next);
    } else {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        syncUrl(next);
      }, 300);
    }

    onChange(next);
    return next;
  }

  function updateFilters(update: Partial<TripFilters>, immediateSync: boolean) {
    setFilters((prev) => applyFilters({ ...prev, ...update }, immediateSync));
  }

  function clearAll() {
    setFilters(() => applyFilters({}, true));
  }

  return (
    <div className="space-y-3" data-testid="trip-filters">
      {/* Filter controls */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Text search */}
        <input
          type="text"
          value={filters.query ?? ""}
          onChange={(e) => updateFilters({ query: e.target.value || undefined }, false)}
          placeholder="Buscar por cliente o título de viaje…"
          className="rounded-xl border border-[#dbc7d1] bg-white px-3 py-2 text-sm text-[#3f1a2f] shadow-[0_2px_8px_rgba(74,9,47,0.03)] outline-none transition placeholder:text-[#927586] focus:border-[#65003d] focus:ring-2 focus:ring-[#65003d]/15 dark:border-[#603d50] dark:bg-[#24141f] dark:text-[#f8eaf0]"
        />

        {/* Status checkboxes */}
        <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-[#dbc7d1] bg-[#fffdfd] px-3 py-2 text-sm dark:border-[#603d50] dark:bg-[#24141f]">
          <legend className="sr-only">Estados</legend>
          {STATUS_OPTIONS.map((s) => {
            const checked = filters.status?.includes(s) ?? false;
            return (
              <label key={s} className="flex items-center gap-1.5 text-[#604355] dark:text-[#efdce6]">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const current = filters.status ?? [];
                    const next = checked ? current.filter((st) => st !== s) : [...current, s];
                    updateFilters({ status: next.length ? next : undefined }, true);
                  }}
                  className="h-4 w-4 rounded border-[#b997a8] accent-[#65003d] dark:border-[#7c5368]"
                />
                {STATUS_LABELS[s]}
              </label>
            );
          })}
        </fieldset>

        {/* Client combobox */}
        <FilterCombobox
          mode="single"
          options={clients}
          selectedIds={filters.clientIds ?? []}
          placeholder="Filtrar por cliente…"
          clearOnEmptyBlur
          onSelect={(id) => updateFilters({ clientIds: [id] }, true)}
          onClear={() => updateFilters({ clientIds: undefined }, true)}
        />

        {/* Tags multi-combobox */}
        <FilterCombobox
          mode="multi"
          options={tags}
          selectedIds={filters.tagIds ?? []}
          placeholder="Filtrar por tags…"
          onSelect={(id) => updateFilters({ tagIds: [...(filters.tagIds ?? []), id] }, true)}
        />

        {/* Agent multi-combobox */}
        {travelAgents && travelAgents.length > 0 && (
          <FilterCombobox
            mode="multi"
            options={travelAgents}
            selectedIds={filters.agentIds ?? []}
            placeholder="Filtrar por agente…"
            onSelect={(id) => updateFilters({ agentIds: [...(filters.agentIds ?? []), id] }, true)}
          />
        )}

        {/* Date range */}
        <div className="flex gap-2">
          <input
            type="date"
            value={filters.dateFrom ?? ""}
            onChange={(e) => updateFilters({ dateFrom: e.target.value || undefined }, true)}
            placeholder="Desde"
            className="w-full rounded-xl border border-[#dbc7d1] bg-white px-3 py-2 text-sm text-[#3f1a2f] shadow-[0_2px_8px_rgba(74,9,47,0.03)] outline-none transition placeholder:text-[#927586] focus:border-[#65003d] focus:ring-2 focus:ring-[#65003d]/15 dark:border-[#603d50] dark:bg-[#24141f] dark:text-[#f8eaf0]"
          />
          <input
            type="date"
            value={filters.dateTo ?? ""}
            onChange={(e) => updateFilters({ dateTo: e.target.value || undefined }, true)}
            placeholder="Hasta"
            className="w-full rounded-xl border border-[#dbc7d1] bg-white px-3 py-2 text-sm text-[#3f1a2f] shadow-[0_2px_8px_rgba(74,9,47,0.03)] outline-none transition placeholder:text-[#927586] focus:border-[#65003d] focus:ring-2 focus:ring-[#65003d]/15 dark:border-[#603d50] dark:bg-[#24141f] dark:text-[#f8eaf0]"
          />
        </div>

        {/* Currency select */}
        <select
          value={filters.currency ?? ""}
          onChange={(e) =>
            updateFilters({ currency: (e.target.value || undefined) as TripCurrency | undefined }, true)
          }
          className="rounded-xl border border-[#dbc7d1] bg-white px-3 py-2 text-sm text-[#3f1a2f] shadow-[0_2px_8px_rgba(74,9,47,0.03)] outline-none transition placeholder:text-[#927586] focus:border-[#65003d] focus:ring-2 focus:ring-[#65003d]/15 dark:border-[#603d50] dark:bg-[#24141f] dark:text-[#f8eaf0]"
        >
          <option value="">Todas las monedas</option>
          {CURRENCY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Active filter badges */}
      <FilterBadges
        filters={filters}
        clients={clients}
        tags={tags}
        travelAgents={travelAgents}
        statusLabels={STATUS_LABELS}
        onUpdate={(update) => updateFilters(update, true)}
        onClearAll={clearAll}
      />
    </div>
  );
}
