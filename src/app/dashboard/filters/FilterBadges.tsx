"use client";

import { useMemo } from "react";
import type { Client, Tag, TravelAgent, TripFilters, TripStatus } from "@/types";

/**
 * Active filter badges with individual remove and a "Limpiar filtros" button.
 * Presentational: it receives the current filters and the lookup arrays and
 * emits updates with the immediate-sync flag already bound by the shell.
 */
export function FilterBadges({
  filters,
  clients,
  tags,
  travelAgents,
  statusLabels,
  onUpdate,
  onClearAll,
}: {
  filters: Partial<TripFilters>;
  clients: Client[];
  tags: Tag[];
  travelAgents?: TravelAgent[];
  statusLabels: Record<TripStatus, string>;
  onUpdate: (update: Partial<TripFilters>) => void;
  onClearAll: () => void;
}) {
  // Derive active badges from current state
  const activeBadges = useMemo(() => {
    const badges: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (filters.query) {
      badges.push({
        key: "query",
        label: `"${filters.query}"`,
        onRemove: () => onUpdate({ query: undefined }),
      });
    }
    if (filters.status?.length) {
      filters.status.forEach((s) => {
        badges.push({
          key: `status-${s}`,
          label: statusLabels[s],
          onRemove: () => {
            const next = (filters.status ?? []).filter((st) => st !== s);
            onUpdate({ status: next.length ? next : undefined });
          },
        });
      });
    }
    if (filters.dateFrom || filters.dateTo) {
      const label = [filters.dateFrom, filters.dateTo].filter(Boolean).join(" – ");
      badges.push({
        key: "date",
        label,
        onRemove: () => onUpdate({ dateFrom: undefined, dateTo: undefined }),
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
            onUpdate({ clientIds: next.length ? next : undefined });
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
            onUpdate({ tagIds: next.length ? next : undefined });
          },
        });
      });
    }
    if (filters.agentIds?.length && travelAgents) {
      filters.agentIds.forEach((aid) => {
        const agent = travelAgents.find((a) => a.id === aid);
        badges.push({
          key: `agent-${aid}`,
          label: agent?.name ?? aid,
          onRemove: () => {
            const next = (filters.agentIds ?? []).filter((id) => id !== aid);
            onUpdate({ agentIds: next.length ? next : undefined });
          },
        });
      });
    }
    if (filters.currency) {
      badges.push({
        key: "currency",
        label: filters.currency,
        onRemove: () => onUpdate({ currency: undefined }),
      });
    }

    return badges;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, clients, tags, travelAgents]);

  if (activeBadges.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {activeBadges.map((badge) => (
        <span
          key={badge.key}
          className="inline-flex items-center gap-1 rounded-full bg-[#f8e8ef] px-3 py-1 text-sm text-[#791b4b] dark:bg-[#54243d] dark:text-[#ffd8a4]"
        >
          {badge.label}
          <button
            type="button"
            onClick={badge.onRemove}
            aria-label={`Quitar filtro ${badge.label}`}
            className="text-[#ad5a7f] hover:text-[#65003d] dark:text-[#efb4cb] dark:hover:text-[var(--operator-brand)]"
          >
            ×
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-sm text-[#8b2356] hover:underline dark:text-[#ffbad3]"
      >
        Limpiar filtros
      </button>
    </div>
  );
}
