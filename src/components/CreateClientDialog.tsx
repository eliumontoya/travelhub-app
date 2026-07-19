"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Client } from "@/types";
import { createClientAction } from "@/app/dashboard/clients/actions";

export function CreateClientDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (client: Client) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && dialogRef.current && !dialogRef.current.open) {
      setError(null);
      dialogRef.current.showModal();
    }
  }, [open]);

  function close() {
    dialogRef.current?.close();
    onClose();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createClientAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.client) {
        onCreated(result.client);
        close();
      }
    });
  }

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-md rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <h3 className="text-lg font-semibold text-gray-900">Crear cliente</h3>

        <div>
          <label htmlFor="client-name" className="block text-sm font-medium text-gray-700">
            Nombre *
          </label>
          <input
            id="client-name"
            name="name"
            type="text"
            required
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Nombre del cliente"
          />
        </div>

        <div>
          <label htmlFor="client-email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="client-email"
            name="email"
            type="email"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="email@ejemplo.com"
          />
        </div>

        <div>
          <label htmlFor="client-phone" className="block text-sm font-medium text-gray-700">
            Teléfono
          </label>
          <input
            id="client-phone"
            name="phone"
            type="tel"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="+54 11 1234-5678"
          />
        </div>

        <div>
          <label htmlFor="client-birth-date" className="block text-sm font-medium text-gray-700">
            Fecha de nacimiento
          </label>
          <input
            id="client-birth-date"
            name="birthDate"
            type="date"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Creando…" : "Crear"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
