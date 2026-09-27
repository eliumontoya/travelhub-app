"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExportClientsCsvButton } from "@/components/export-clients-csv-button";
import { formatTags } from "@/lib/item-meta";
import { normalizeFilterText } from "@/lib/trip-filters";
import type { Client, Tag } from "@/types";
import { deleteClientAction } from "./actions";
import { DeleteClientButton } from "./DeleteClientButton";

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
      <section className="mb-5 rounded-2xl border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex-1 text-sm font-medium text-[var(--operator-ink)]">
            Buscar por nombre
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cliente por nombre…"
              className="mt-2 w-full rounded-xl border border-[var(--operator-border)] bg-white px-4 py-3 text-sm text-[var(--operator-ink)] outline-none transition placeholder:text-[var(--operator-ink-subtle)] focus:border-[var(--operator-brand)] focus:ring-2 focus:ring-[var(--operator-brand)]/15"
            />
          </label>
          <ExportClientsCsvButton clients={filteredClients} />
        </div>
        <p className="mt-3 text-sm text-[var(--operator-ink-muted)]">
          {totalCount} cliente{totalCount === 1 ? "" : "s"} registrado{totalCount === 1 ? "" : "s"}; {filteredClients.length} visible{filteredClients.length === 1 ? "" : "s"} en esta página.
        </p>
      </section>

      <div className="grid gap-3">
        {filteredClients.map((client) => (
          <div
            key={client.id}
            className="rounded-2xl border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_12px_30px_rgba(81,0,52,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(81,0,52,0.09)]"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <Link href={`/dashboard/clients/${client.id}`} className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--operator-brand)]">{client.name}</p>
                <p className="mt-1 text-sm text-[var(--operator-ink-muted)]">
                  {[client.email, client.phone].filter(Boolean).join(" · ")}
                </p>
                {client.tags.length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {formatTags(client.tags).map((name) => (
                      <li
                        key={name}
                        className="rounded-full bg-[var(--operator-surface-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--operator-brand)]"
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </Link>
              <DeleteClientButton
                clientName={client.name}
                action={deleteClientAction.bind(null, client.id)}
              />
            </div>
          </div>
        ))}
        {clients.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[var(--operator-border)] bg-white/70 p-5 text-center text-sm text-[var(--operator-ink-muted)]">
            Todavía no hay clientes registrados.
          </p>
        )}
        {clients.length > 0 && filteredClients.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[var(--operator-border)] bg-white/70 p-5 text-center text-sm text-[var(--operator-ink-muted)]">
            Ningún cliente coincide con la búsqueda en esta página.
          </p>
        )}
      </div>
    </>
  );
}
