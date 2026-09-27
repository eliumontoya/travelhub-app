"use client";

import { useRef, useTransition } from "react";
import { formatDateLong } from "@/lib/item-meta";

export function DuplicateItemDialog({
  trigger,
  itemTitle,
  days,
  sourceDayId,
  onDuplicate,
}: {
  trigger: React.ReactNode;
  itemTitle: string;
  days: { id: string; date: string }[];
  sourceDayId: string;
  onDuplicate: (targetDayId: string) => Promise<void>;
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
    const targetDayId = String(new FormData(e.currentTarget).get("targetDayId") ?? "");
    if (!targetDayId) return;
    startTransition(async () => {
      await onDuplicate(targetDayId);
      close();
    });
  }

  return (
    <>
      <span onClick={open} className="cursor-pointer">
        {trigger}
      </span>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-[var(--operator-border)] p-0 backdrop:bg-black/40"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <h3 className="text-lg font-semibold text-[var(--operator-brand)]">Duplicar item</h3>
          <p className="text-sm text-[var(--operator-ink-muted)]">
            Se creará una copia de <span className="font-medium text-[var(--operator-ink)]">{itemTitle}</span> en el
            día que elijas, con los mismos datos (sin documentos adjuntos).
          </p>

          <div>
            <label className="block text-sm font-medium text-[var(--operator-ink)]">Día de destino</label>
            <select
              name="targetDayId"
              defaultValue={sourceDayId}
              required
              className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
            >
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDateLong(d.date)}
                  {d.id === sourceDayId ? " (día actual)" : ""}
                </option>
              ))}
            </select>
          </div>

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
              {isPending ? "Duplicando…" : "Duplicar"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
