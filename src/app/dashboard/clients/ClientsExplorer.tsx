"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExportClientsCsvButton } from "@/components/export-clients-csv-button";
import { formatTags } from "@/lib/item-meta";
import { normalizeFilterText } from "@/lib/trip-filters";
import type { Client, Tag } from "@/types";

type ClientListItem = Client & { tags: Tag[] };

export function ClientsExplorer({
  clients,
  totalCount,
}: {
  clients: ClientListItem[];
  totalCount: number;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeFilterText(query.trim());

  const filteredClients = useMemo(() => {
    if (!normalizedQuery) return clients;
    return clients.filter((client) => normalizeFilterText(client.name).includes(normalizedQuery));
  }, [clients, normalizedQuery]);

  return (
    <>
      <section className="mb-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
            Buscar por nombre
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cliente por nombre…"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-950"
            />
          </label>
          <ExportClientsCsvButton clients={filteredClients} />
        </div>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {totalCount} cliente{totalCount === 1 ? "" : "s"} registrado{totalCount === 1 ? "" : "s"}; {filteredClients.length} visible{filteredClients.length === 1 ? "" : "s"} en esta página.
        </p>
      </section>

      <div className="grid gap-3">
        {filteredClients.map((client) => (
          <Link
            key={client.id}
            href={`/dashboard/clients/${client.id}`}
            className="rounded-lg border border-gray-200 bg-white p-4 transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:shadow-none"
          >
            <p className="font-medium text-gray-900 dark:text-gray-100">{client.name}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {[client.email, client.phone].filter(Boolean).join(" · ")}
            </p>
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
        {clients.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
            Todavía no hay clientes registrados.
          </p>
        )}
        {clients.length > 0 && filteredClients.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
            Ningún cliente coincide con la búsqueda en esta página.
          </p>
        )}
      </div>
    </>
  );
}
