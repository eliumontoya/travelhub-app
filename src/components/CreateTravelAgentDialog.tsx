"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { TravelAgent } from "@/types";
import { RichTextEditor } from "@/components/RichTextEditor";
import {
  createTravelAgentAction,
  updateTravelAgentAction,
} from "@/app/dashboard/travel-agents/actions";

export function CreateTravelAgentDialog({
  open,
  onClose,
  onCreated,
  onUpdated,
  agent,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (agent: TravelAgent) => void;
  onUpdated?: () => void;
  agent?: TravelAgent;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(agent);

  useEffect(() => {
    if (open && dialogRef.current && !dialogRef.current.open) {
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
      if (isEditing && agent) {
        const result = await updateTravelAgentAction(agent.id, formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        onUpdated?.();
        close();
      } else {
        const result = await createTravelAgentAction(formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.agent) {
          onCreated?.(result.agent);
          close();
        }
      }
    });
  }

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-md rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <h3 className="text-lg font-semibold text-gray-900">
          {isEditing ? "Editar agente" : "Crear agente"}
        </h3>

        <div>
          <label htmlFor="agent-name" className="block text-sm font-medium text-gray-700">
            Nombre *
          </label>
          <input
            id="agent-name"
            name="name"
            type="text"
            required
            defaultValue={agent?.name}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Nombre del agente"
          />
        </div>

        <div>
          <label htmlFor="agent-email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="agent-email"
            name="email"
            type="email"
            defaultValue={agent?.email}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="email@ejemplo.com"
          />
        </div>

        <div>
          <label htmlFor="agent-phone" className="block text-sm font-medium text-gray-700">
            Teléfono
          </label>
          <input
            id="agent-phone"
            name="phone"
            type="tel"
            defaultValue={agent?.phone}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="+54 11 1234-5678"
          />
        </div>

        <div>
          <label htmlFor="agent-notes" className="block text-sm font-medium text-gray-700">
            Notas
          </label>
          <RichTextEditor
            name="notes"
            defaultValue={agent?.notes}
            placeholder="Notas del agente (admite negrita, listas, enlaces…)"
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
            {isPending ? "Guardando…" : isEditing ? "Guardar" : "Crear"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
