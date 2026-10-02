"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Client } from "@/types";
import { setVisaClientsAction } from "./actions";

export function VisaClientManager({
  visaId,
  initialClients,
  clientOptions,
}: {
  visaId: string;
  initialClients: Client[];
  clientOptions: Client[];
}) {
  const router = useRouter();
  const [assignedIds, setAssignedIds] = useState<string[]>(
    initialClients.map((c) => c.id),
  );
  const [pickerValue, setPickerValue] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const assignedSet = useMemo(() => new Set(assignedIds), [assignedIds]);

  const availableClients = useMemo(
    () => clientOptions.filter((c) => !assignedSet.has(c.id)),
    [clientOptions, assignedSet],
  );

  const assignedClients = useMemo(
    () =>
      assignedIds
        .map((id) => clientOptions.find((c) => c.id === id) ?? initialClients.find((c) => c.id === id))
        .filter((c): c is Client => Boolean(c)),
    [assignedIds, clientOptions, initialClients],
  );

  function persist(next: string[]) {
    setError(null);
    startTransition(async () => {
      const result = await setVisaClientsAction(visaId, next);
      if (!result.ok) {
        setError(result.error ?? "No se pudieron actualizar los clientes asignados.");
        return;
      }
      setAssignedIds(next);
      router.refresh();
    });
  }

  function addClient() {
    if (!pickerValue || assignedSet.has(pickerValue)) {
      setPickerValue("");
      return;
    }
    persist([...assignedIds, pickerValue]);
    setPickerValue("");
  }

  function removeClient(id: string) {
    persist(assignedIds.filter((cid) => cid !== id));
  }

  return (
    <div className="space-y-4" data-testid="visa-client-manager">
      {assignedClients.length === 0 ? (
        <p className="text-sm text-[var(--operator-ink-muted)]">
          Sin clientes asignados todavía.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {assignedClients.map((client) => (
            <li
              key={client.id}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--operator-surface-subtle)] px-3 py-1 text-sm"
            >
              <span>{client.name}</span>
              <button
                type="button"
                onClick={() => removeClient(client.id)}
                aria-label={`Eliminar ${client.name}`}
                disabled={isPending}
                className="ml-1 text-xs text-[var(--operator-coral)] hover:underline disabled:opacity-60"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[12rem]">
          <label
            htmlFor="visa-client-picker"
            className="block text-xs font-semibold uppercase tracking-wider text-[var(--operator-ink-muted)]"
          >
            Agregar cliente
          </label>
          <select
            id="visa-client-picker"
            value={pickerValue}
            onChange={(e) => setPickerValue(e.target.value)}
            disabled={isPending || availableClients.length === 0}
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          >
            <option value="">
              {availableClients.length === 0 ? "Todos los clientes están asignados" : "Selecciona un cliente"}
            </option>
            {availableClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={addClient}
          disabled={isPending || !pickerValue}
          className="rounded-lg bg-[var(--operator-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--operator-brand-strong)] disabled:opacity-60"
        >
          {isPending ? "Guardando…" : "Asignar"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--operator-coral)]">
          {error}
        </p>
      )}
    </div>
  );
}
