"use client";

import { useState } from "react";
import type { Client } from "@/types";
import { createVisaAction } from "./actions";

export function NewVisaForm({
  clients,
  error,
}: {
  clients: Client[];
  error?: string;
}) {
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);

  function toggleClient(clientId: string) {
    setSelectedClientIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId],
    );
  }

  return (
    <form action={createVisaAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="visa-country"
            className="block text-sm font-medium text-[var(--operator-ink)]"
          >
            País / consulado
          </label>
          <input
            id="visa-country"
            name="country"
            required
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
            placeholder="Francia"
          />
        </div>
        <div>
          <label
            htmlFor="visa-type"
            className="block text-sm font-medium text-[var(--operator-ink)]"
          >
            Tipo de visa
          </label>
          <input
            id="visa-type"
            name="visaType"
            required
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
            placeholder="Turista, Negocios, Estudiante…"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="visa-deadline"
            className="block text-sm font-medium text-[var(--operator-ink)]"
          >
            Fecha límite
          </label>
          <input
            id="visa-deadline"
            type="date"
            name="deadline"
            required
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="visa-price"
            className="block text-sm font-medium text-[var(--operator-ink)]"
          >
            Precio
          </label>
          <input
            id="visa-price"
            type="number"
            name="price"
            min={0}
            step="0.01"
            required
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="visa-notes"
          className="block text-sm font-medium text-[var(--operator-ink)]"
        >
          Notas
        </label>
        <textarea
          id="visa-notes"
          name="notes"
          rows={3}
          className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          placeholder="Información adicional para el expediente (opcional)"
        />
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-[var(--operator-ink)]">
          Clientes asignados
        </legend>
        <p className="mt-1 text-xs text-[var(--operator-ink-muted)]">
          Opcional. Podrás asignarlos después desde el detalle de la visa.
        </p>
        {clients.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--operator-ink-muted)]">
            No hay clientes registrados todavía.
          </p>
        ) : (
          <ul className="mt-2 grid max-h-60 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-[var(--operator-border)] p-2 sm:grid-cols-2">
            {clients.map((client) => {
              const checked = selectedClientIds.includes(client.id);
              return (
                <li key={client.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-[var(--operator-surface-subtle)]">
                    <input
                      type="checkbox"
                      name="clientIds"
                      value={client.id}
                      checked={checked}
                      onChange={() => toggleClient(client.id)}
                      className="rounded border-[var(--operator-border)]"
                    />
                    <span className="truncate text-[var(--operator-ink)]">{client.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-[var(--operator-coral)]">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="w-full rounded-lg bg-[var(--operator-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--operator-brand-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--operator-focus)]"
      >
        Crear visa
      </button>
    </form>
  );
}
