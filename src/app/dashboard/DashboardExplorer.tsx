"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Client, Tag, TripStatus } from "@/types";
import { formatAssignedClients, formatDateShort, formatTags } from "@/lib/item-meta";

const statusMeta: Record<TripStatus, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
  published: {
    label: "Publicado",
    color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  },
  archived: { label: "Archivado", color: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500" },
};

type TripListItem = {
  id: string;
  title: string;
  status: TripStatus;
  startDate: string;
  endDate: string;
  clients: Client[];
  tags: Tag[];
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

type ClientListItem = Client & { tags: Tag[] };

export function DashboardExplorer({
  trips,
  clients,
  tags,
  tripsPagination,
  clientsPagination,
}: {
  trips: TripListItem[];
  clients: ClientListItem[];
  tags: Tag[];
  tripsPagination?: ReactNode;
  clientsPagination?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TripStatus | "all">("all");
  const [tagFilter, setTagFilter] = useState<string>("all");

  const normalizedQuery = normalize(query.trim());

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      if (statusFilter !== "all" && trip.status !== statusFilter) return false;
      if (tagFilter !== "all" && !trip.tags.some((t) => t.id === tagFilter)) return false;
      if (!normalizedQuery) return true;
      const haystack = [trip.title, ...trip.clients.map((c) => c.name)]
        .map(normalize)
        .join(" ");
      return haystack.includes(normalizedQuery);
    });
  }, [trips, statusFilter, tagFilter, normalizedQuery]);

  const filteredClients = useMemo(() => {
    if (!normalizedQuery) return clients;
    return clients.filter((client) => normalize(client.name).includes(normalizedQuery));
  }, [clients, normalizedQuery]);

  const hasActiveFilters = normalizedQuery.length > 0 || statusFilter !== "all" || tagFilter !== "all";

  return (
    <>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por cliente o título de viaje…"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-1 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TripStatus | "all")}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="all">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="published">Publicado</option>
          <option value="archived">Archivado</option>
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="all">Todos los tags</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4">
        {filteredTrips.map((trip) => {
          const status = statusMeta[trip.status];
          return (
            <Link
              key={trip.id}
              href={`/dashboard/trips/${trip.id}`}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:shadow-none"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">{trip.title}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{formatAssignedClients(trip.clients)}</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  {formatDateShort(trip.startDate)} – {formatDateShort(trip.endDate)}
                </p>
                {trip.tags.length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {formatTags(trip.tags).map((name) => (
                      <li
                        key={name}
                        className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <span className="text-gray-300 dark:text-gray-600">→</span>
            </Link>
          );
        })}
        {filteredTrips.length === 0 && (
          <p className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
            {hasActiveFilters ? "Ningún viaje coincide con la búsqueda o los filtros." : "Todavía no hay viajes."}
          </p>
        )}
      </div>

      {tripsPagination}

      <h2 className="mt-10 mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Clientes</h2>
      <div className="grid gap-3">
        {filteredClients.map((client) => (
          <Link
            key={client.id}
            href={`/dashboard/clients/${client.id}`}
            className="rounded-lg border border-gray-200 bg-white p-4 transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:shadow-none"
          >
            <p className="font-medium text-gray-900 dark:text-gray-100">{client.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{client.email} · {client.phone}</p>
            {client.tags.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {formatTags(client.tags).map((name) => (
                  <li
                    key={name}
                    className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </Link>
        ))}
        {filteredClients.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
            Ningún cliente coincide con la búsqueda.
          </p>
        )}
      </div>

      {clientsPagination}
    </>
  );
}
