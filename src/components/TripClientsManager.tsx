"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Client } from "@/types";
import { ClientMultiCombobox } from "@/components/ClientMultiCombobox";
import { createClientAction } from "@/app/dashboard/clients/actions";

// Dialog de gestión de clientes asignados a un viaje (nueva capacidad, no
// existía ni para el caso singular). Sigue el patrón bound-action de
// TripInstructionsDialog: client leaf + server action pasada como onSubmit.
export function TripClientsManager({
  trigger,
  clients: initialClients,
  assignedClientIds,
  onSubmit,
}: {
  trigger: React.ReactNode;
  clients: Client[];
  assignedClientIds: string[];
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [selectedIds, setSelectedIds] = useState<string[]>(assignedClientIds);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function open() {
    setError(null);
    setSelectedIds(assignedClientIds);
    setShowCreate(false);
    setNewName("");
    setNewEmail("");
    setCreateError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  async function handleCreateClient() {
    if (!newName.trim()) {
      setCreateError("El nombre es obligatorio");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const fd = new FormData();
      fd.append("name", newName.trim());
      fd.append("email", newEmail.trim());
      fd.append("phone", "");
      const result = await createClientAction(fd);
      if (result.error) {
        setCreateError(result.error);
      } else if (result.client) {
        setClients((prev) => [...prev, result.client!]);
        setSelectedIds((prev) => [...prev, result.client!.id]);
        setNewName("");
        setNewEmail("");
        setShowCreate(false);
      }
    } catch {
      setCreateError("Error al crear cliente");
    } finally {
      setCreating(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selectedIds.length < 1) {
      setError("Selecciona al menos un cliente");
      return;
    }
    setError(null);
    const fd = new FormData();
    selectedIds.forEach((id) => fd.append("clientIds", id));
    startTransition(async () => {
      try {
        await onSubmit(fd);
        router.refresh();
        close();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudieron guardar los cambios.");
      }
    });
  }

  return (
    <>
      <span onClick={open}>{trigger}</span>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-[var(--operator-border)] p-0 backdrop:bg-black/40"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <h3 className="text-lg font-semibold text-[var(--operator-brand)]">Gestionar clientes</h3>

          <div>
            <label className="block text-sm font-medium text-[var(--operator-ink)]">Clientes asignados</label>
            <ClientMultiCombobox
              clients={clients}
              name="clientIds"
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
          </div>

          {!showCreate ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="w-full rounded-lg border border-dashed border-[var(--operator-border)] py-2 text-sm text-[var(--operator-ink-muted)] hover:bg-[var(--operator-canvas)]"
            >
              + Crear cliente nuevo
            </button>
          ) : (
            <fieldset className="rounded-lg border border-[var(--operator-border)] p-3 space-y-2">
              <legend className="px-1 text-sm font-medium text-[var(--operator-ink)]">Nuevo cliente</legend>
              <input
                type="text"
                placeholder="Nombre *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
              />
              <input
                type="email"
                placeholder="Email (opcional)"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
              />
              {createError && <p className="text-sm text-[var(--operator-coral)]">{createError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setCreateError(null); }}
                  className="rounded-lg border border-[var(--operator-border)] px-3 py-1.5 text-sm text-[var(--operator-ink-muted)] hover:bg-[var(--operator-canvas)]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateClient}
                  disabled={creating}
                  className="rounded-lg bg-[var(--operator-brand)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--operator-brand-strong)] disabled:opacity-50"
                >
                  {creating ? "Creando…" : "Crear"}
                </button>
              </div>
            </fieldset>
          )}

          {error && <p className="text-sm text-[var(--operator-coral)]">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-[var(--operator-border)] px-4 py-2 text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-[var(--operator-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--operator-brand-strong)] disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
