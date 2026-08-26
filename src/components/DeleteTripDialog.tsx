"use client";

import { useState } from "react";

export function DeleteTripDialog({
  tripTitle,
  action,
}: {
  tripTitle: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const matches = confirmTitle === tripTitle;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-red-200 px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-950 dark:text-red-300 dark:hover:bg-red-950/30"
      >
        Eliminar viaje
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-950">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Eliminar viaje</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Esta acción borrará permanentemente el viaje y sus datos relacionados. Para confirmar, escribe el nombre exacto:
            </p>
            <p className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 dark:bg-gray-900 dark:text-gray-100">
              {tripTitle}
            </p>
            <form
              action={action}
              onSubmit={(event) => {
                if (!matches || !window.confirm(`¿Eliminar permanentemente "${tripTitle}"?`)) {
                  event.preventDefault();
                }
              }}
              className="mt-4 space-y-4"
            >
              <input
                name="confirmTitle"
                value={confirmTitle}
                onChange={(event) => setConfirmTitle(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                autoComplete="off"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!matches}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Borrar definitivamente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
