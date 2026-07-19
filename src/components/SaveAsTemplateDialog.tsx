"use client";

import { useRef, useTransition } from "react";

export function SaveAsTemplateDialog({
  trigger,
  defaultTitle,
  onSubmit,
}: {
  trigger: React.ReactNode;
  defaultTitle: string;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();

  function open() {
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
          <h3 className="text-lg font-semibold text-gray-900">Guardar como plantilla</h3>
          <p className="text-sm text-gray-500">
            Se copiarán los días e items de este viaje (sin documentos) a una nueva plantilla
            reusable, sin cliente asociado.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nombre de la plantilla
            </label>
            <input
              name="title"
              required
              defaultValue={`Plantilla: ${defaultTitle}`}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

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
              {isPending ? "Guardando…" : "Guardar plantilla"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
