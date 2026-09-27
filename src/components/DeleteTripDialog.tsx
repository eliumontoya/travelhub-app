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
        className="w-full rounded-lg border border-[var(--operator-coral)]/40 px-3 py-2 text-left text-sm font-medium text-[var(--operator-coral)] hover:bg-[var(--operator-coral)]/10 dark:border-[var(--operator-coral)]/40 dark:text-[var(--operator-coral)] dark:hover:bg-[var(--operator-coral)]/10/30"
      >
        Eliminar viaje
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-[var(--operator-brand-strong)]">
            <h3 className="text-lg font-semibold text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">Eliminar viaje</h3>
            <p className="mt-2 text-sm text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">
              Esta acción borrará permanentemente el viaje y sus datos relacionados. Para confirmar, escribe el nombre exacto:
            </p>
            <p className="mt-3 rounded-lg bg-[var(--operator-surface-subtle)] px-3 py-2 text-sm font-medium text-[var(--operator-brand)] dark:bg-[var(--operator-brand-strong)] dark:text-[var(--operator-brand)]">
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
                className="w-full rounded-lg border border-[var(--operator-border)] bg-white px-3 py-2 text-sm text-[var(--operator-brand)] dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)] dark:text-[var(--operator-brand)]"
                autoComplete="off"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-[var(--operator-border)] px-4 py-2 text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand-strong)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!matches}
                  className="rounded-lg bg-[var(--operator-coral)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--operator-coral)]/80 disabled:cursor-not-allowed disabled:opacity-50"
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
