"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Client, Tag, TripFilters, TripStatus, TripCurrency } from "@/types";

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

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
}: {
  onChange: (filters: Partial<TripFilters>) => void;
  clients: Client[];
  tags: Tag[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Partial<TripFilters>>(() =>
    deserializeFilters(searchParams),
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientJustSelected = useRef(false);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  function syncUrl(f: Partial<TripFilters>) {
    const params = new URLSearchParams(searchParams.toString());
    const filterKeys = ["q", "status", "dateFrom", "dateTo", "client", "tags", "currency", "page", "clientsPage"] as const;
    filterKeys.forEach((key) => params.delete(key));

    if (f.query) params.set("q", f.query);
    if (f.status?.length) params.set("status", f.status.join(","));
    if (f.dateFrom) params.set("dateFrom", f.dateFrom);
    if (f.dateTo) params.set("dateTo", f.dateTo);
    if (f.clientIds?.length) params.set("client", f.clientIds.join(","));
    if (f.tagIds?.length) params.set("tags", f.tagIds.join(","));
    if (f.currency) params.set("currency", f.currency);

    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function clean(f: Partial<TripFilters>): Partial<TripFilters> {
    const next = { ...f };
    if (!next.query) delete next.query;
    if (!next.status?.length) delete next.status;
    if (!next.dateFrom) delete next.dateFrom;
    if (!next.dateTo) delete next.dateTo;
    if (!next.clientIds?.length) delete next.clientIds;
    if (!next.tagIds?.length) delete next.tagIds;
    if (!next.currency) delete next.currency;
    return next;
  }

  function applyFilters(nextFilters: Partial<TripFilters>, immediateSync: boolean) {
    const next = clean(nextFilters);

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

  // Derive active badges from current state
  const activeBadges = useMemo(() => {
    const badges: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (filters.query) {
      badges.push({
        key: "query",
        label: `"${filters.query}"`,
        onRemove: () => updateFilters({ query: undefined }, true),
      });
    }
    if (filters.status?.length) {
      filters.status.forEach((s) => {
        badges.push({
          key: `status-${s}`,
          label: STATUS_LABELS[s],
          onRemove: () => {
            const next = (filters.status ?? []).filter((st) => st !== s);
            updateFilters({ status: next.length ? next : undefined }, true);
          },
        });
      });
    }
    if (filters.dateFrom || filters.dateTo) {
      const label = [filters.dateFrom, filters.dateTo].filter(Boolean).join(" – ");
      badges.push({
        key: "date",
        label,
        onRemove: () => updateFilters({ dateFrom: undefined, dateTo: undefined }, true),
      });
    }
    if (filters.clientIds?.length) {
      filters.clientIds.forEach((cid) => {
        const client = clients.find((c) => c.id === cid);
        badges.push({
          key: `client-${cid}`,
          label: client?.name ?? cid,
          onRemove: () => {
            const next = (filters.clientIds ?? []).filter((id) => id !== cid);
            updateFilters({ clientIds: next.length ? next : undefined }, true);
          },
        });
      });
    }
    if (filters.tagIds?.length) {
      filters.tagIds.forEach((tid) => {
        const tag = tags.find((t) => t.id === tid);
        badges.push({
          key: `tag-${tid}`,
          label: tag?.name ?? tid,
          onRemove: () => {
            const next = (filters.tagIds ?? []).filter((id) => id !== tid);
            updateFilters({ tagIds: next.length ? next : undefined }, true);
          },
        });
      });
    }
    if (filters.currency) {
      badges.push({
        key: "currency",
        label: filters.currency,
        onRemove: () => updateFilters({ currency: undefined }, true),
      });
    }

    return badges;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, clients, tags]);

  // Client combobox state
  const [clientQuery, setClientQuery] = useState("");
  const [clientOpen, setClientOpen] = useState(false);
  const clientResults = useMemo(() => {
    const q = normalize(clientQuery.trim());
    if (!q) return [];
    return clients.filter((c) => normalize(c.name).includes(q)).slice(0, 8);
  }, [clients, clientQuery]);

  // Tag multi-combobox state
  const [tagQuery, setTagQuery] = useState("");
  const [tagOpen, setTagOpen] = useState(false);
  const tagResults = useMemo(() => {
    const selected = filters.tagIds ?? [];
    const q = normalize(tagQuery.trim());
    if (!q) return [];
    return tags
      .filter((t) => !selected.includes(t.id))
      .filter((t) => normalize(t.name).includes(q))
      .slice(0, 8);
  }, [tags, tagQuery, filters.tagIds]);

  return (
    <div className="space-y-3">
      {/* Filter controls */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Text search */}
        <input
          type="text"
          value={filters.query ?? ""}
          onChange={(e) => updateFilters({ query: e.target.value || undefined }, false)}
          placeholder="Buscar por cliente o título de viaje…"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />

        {/* Status checkboxes */}
        <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700">
          <legend className="sr-only">Estados</legend>
          {STATUS_OPTIONS.map((s) => {
            const checked = filters.status?.includes(s) ?? false;
            return (
              <label key={s} className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const current = filters.status ?? [];
                    const next = checked ? current.filter((st) => st !== s) : [...current, s];
                    updateFilters({ status: next.length ? next : undefined }, true);
                  }}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                />
                {STATUS_LABELS[s]}
              </label>
            );
          })}
        </fieldset>

        {/* Client combobox */}
        <div className="relative">
          <input
            type="text"
            value={clientQuery}
            onChange={(e) => {
              setClientQuery(e.target.value);
              setClientOpen(true);
            }}
            onFocus={() => setClientOpen(true)}
            onBlur={() => {
              setTimeout(() => setClientOpen(false), 150);
              // Clear client filter when user empties the search field and leaves
              if (!clientJustSelected.current && !clientQuery.trim() && filters.clientIds?.length) {
                updateFilters({ clientIds: undefined }, true);
              }
              clientJustSelected.current = false;
            }}
            placeholder="Filtrar por cliente…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            autoComplete="off"
          />
          {clientOpen && clientResults.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-900">
              {clientResults.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      clientJustSelected.current = true;
                      setClientQuery("");
                      setClientOpen(false);
                      updateFilters({ clientIds: [c.id] }, true);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Tags multi-combobox */}
        <div className="relative">
          <input
            type="text"
            value={tagQuery}
            onChange={(e) => {
              setTagQuery(e.target.value);
              setTagOpen(true);
            }}
            onFocus={() => setTagOpen(true)}
            onBlur={() => setTimeout(() => setTagOpen(false), 150)}
            placeholder="Filtrar por tags…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            autoComplete="off"
          />
          {tagOpen && tagResults.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-900">
              {tagResults.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setTagQuery("");
                      setTagOpen(false);
                      const next = [...(filters.tagIds ?? []), t.id];
                      updateFilters({ tagIds: next }, true);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    {t.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Date range */}
        <div className="flex gap-2">
          <input
            type="date"
            value={filters.dateFrom ?? ""}
            onChange={(e) => updateFilters({ dateFrom: e.target.value || undefined }, true)}
            placeholder="Desde"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <input
            type="date"
            value={filters.dateTo ?? ""}
            onChange={(e) => updateFilters({ dateTo: e.target.value || undefined }, true)}
            placeholder="Hasta"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Currency select */}
        <select
          value={filters.currency ?? ""}
          onChange={(e) =>
            updateFilters({ currency: (e.target.value || undefined) as TripCurrency | undefined }, true)
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
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
      {activeBadges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeBadges.map((badge) => (
            <span
              key={badge.key}
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            >
              {badge.label}
              <button
                type="button"
                onClick={badge.onRemove}
                aria-label={`Quitar filtro ${badge.label}`}
                className="text-blue-400 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-sm text-red-600 hover:underline dark:text-red-400"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}

function deserializeFilters(searchParams: URLSearchParams): Partial<TripFilters> {
  const filters: Partial<TripFilters> = {};
  const q = searchParams.get("q");
  if (q) filters.query = q;
  const status = searchParams.get("status");
  if (status) {
    const valid = status.split(",").filter((s): s is TripStatus =>
      ["draft", "published", "archived"].includes(s),
    );
    if (valid.length) filters.status = valid;
  }
  const dateFrom = searchParams.get("dateFrom");
  if (dateFrom) filters.dateFrom = dateFrom;
  const dateTo = searchParams.get("dateTo");
  if (dateTo) filters.dateTo = dateTo;
  const client = searchParams.get("client");
  if (client) filters.clientIds = client.split(",");
  const tags = searchParams.get("tags");
  if (tags) filters.tagIds = tags.split(",");
  const currency = searchParams.get("currency") as TripCurrency | null;
  if (currency && CURRENCY_OPTIONS.includes(currency)) filters.currency = currency;
  return filters;
}
