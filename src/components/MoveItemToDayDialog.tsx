"use client";

import { useRef, useTransition } from "react";
import { formatDateLong } from "@/lib/item-meta";

type DayOption = { id: string; date: string };

export function MoveItemToDayDialog({
  trigger,
  tripId,
  itemId,
  days,
  currentDayId,
  onMove,
}: {
  trigger: React.ReactNode;
  tripId: string;
  itemId: string;
  days: DayOption[];
  currentDayId: string;
  onMove: (tripId: string, itemId: string, formData: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();

  const targets = days.filter((d) => d.id !== currentDayId);

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
      await onMove(tripId, itemId, formData);
      close();
    });
  }

  if (targets.length === 0) return null;

  return (
    <>
      <span onClick={open} className="cursor-pointer">
        {trigger}
      </span>
      <dialog
        ref={dialogRef}
        className="w-full max-w-sm rounded-xl border border-[var(--operator-border)] p-0 backdrop:bg-black/40"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <h3 className="text-lg font-semibold text-[var(--operator-brand)]">Mover a otro día</h3>
          <div>
            <label className="block text-sm font-medium text-[var(--operator-ink)]">Día destino</label>
            <select
              name="targetDayId"
              required
              defaultValue={targets[0]?.id}
              className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
            >
              {targets.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDateLong(d.date)}
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
              Mover
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
