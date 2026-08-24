"use client";

import { useRef, useState, useTransition } from "react";
import { RichTextEditor } from "@/components/RichTextEditor";

export function TripInternalNotesDialog({
  trigger,
  internalNotes,
  onSubmit,
}: {
  trigger: React.ReactNode;
  internalNotes: string | null;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await onSubmit(formData);
      close();
    });
  }

  return (
    <>
      <span onClick={open}>{trigger}</span>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <h3 className="text-lg font-semibold text-gray-900">Notas internas</h3>
          <p className="text-xs text-gray-500">
            Solo visibles para el equipo. Nunca se muestran en la página pública del viaje.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700">Notas</label>
            <RichTextEditor
              name="internalNotes"
              defaultValue={internalNotes ?? ""}
              placeholder="Preferencias del cliente, alertas internas, comisiones, proveedores…"
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
              Guardar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
