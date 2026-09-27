"use client";

import { useRef } from "react";
import type { ChangelogEntry } from "@/lib/changelog";

export function ChangelogDialog({ entries }: { entries: ChangelogEntry[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--operator-ink-muted)] hover:bg-[var(--operator-surface-subtle)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
      >
        Qué hay de nuevo
      </button>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-[var(--operator-border)] p-0 backdrop:bg-black/40 dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)]"
      >
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">Qué hay de nuevo</h3>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar"
              className="rounded-lg px-2 py-1 text-sm text-[var(--operator-ink-muted)] hover:bg-[var(--operator-canvas)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
            >
              ✕
            </button>
          </div>

          <ul className="max-h-96 space-y-4 overflow-y-auto">
            {entries.map((entry) => (
              <li
                key={entry.date + entry.title}
                className="border-b border-[var(--operator-border)] pb-3 last:border-0 last:pb-0 dark:border-[var(--operator-border)]"
              >
                <p className="text-xs text-[var(--operator-ink-subtle)] dark:text-[var(--operator-ink-muted)]">{entry.date}</p>
                <p className="text-sm font-medium text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">{entry.title}</p>
                <p className="mt-1 text-sm text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">{entry.description}</p>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-end pt-2">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-[var(--operator-border)] px-4 py-2 text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
            >
              Cerrar
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
