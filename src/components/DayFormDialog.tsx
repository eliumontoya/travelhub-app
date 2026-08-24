"use client";

import { useRef, useState, useTransition } from "react";
import { TripDay } from "@/types";
import { showUndoToast } from "@/components/UndoToast";
import { RichTextEditor } from "@/components/RichTextEditor";

export function DayFormDialog({
  trigger,
  day,
  onSubmit,
  onDelete,
  onUndoDelete,
}: {
  trigger: React.ReactNode;
  day?: TripDay;
  onSubmit: (formData: FormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onUndoDelete?: () => Promise<void>;
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
    if (!String(formData.get("date") ?? "").trim()) {
      setError("La fecha es obligatoria");
      return;
    }
    startTransition(async () => {
      await onSubmit(formData);
      close();
    });
  }

  function handleDelete() {
    if (!onDelete) return;
    if (!confirm("¿Eliminar este día y todos sus items?")) return;
    startTransition(async () => {
      await onDelete();
      close();
      if (onUndoDelete) {
        showUndoToast({ message: "Día eliminado", onUndo: onUndoDelete });
      }
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
          <h3 className="text-lg font-semibold text-gray-900">{day ? "Editar día" : "Agregar día"}</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha</label>
            <input
              type="date"
              name="date"
              defaultValue={day?.date}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Notas</label>
            <RichTextEditor name="notes" defaultValue={day?.notes} placeholder="Notas del día (admite negrita, listas, enlaces…)" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="text-sm text-red-600 hover:underline"
                >
                  Eliminar
                </button>
              )}
            </div>
            <div className="flex gap-2">
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
          </div>
        </form>
      </dialog>
    </>
  );
}
