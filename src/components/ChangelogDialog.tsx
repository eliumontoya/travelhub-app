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
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        Qué hay de nuevo
      </button>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-gray-200 p-0 backdrop:bg-black/40 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Qué hay de nuevo</h3>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar"
              className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              ✕
            </button>
          </div>

          <ul className="max-h-96 space-y-4 overflow-y-auto">
            {entries.map((entry) => (
              <li
                key={entry.date + entry.title}
                className="border-b border-gray-100 pb-3 last:border-0 last:pb-0 dark:border-gray-800"
              >
                <p className="text-xs text-gray-400 dark:text-gray-500">{entry.date}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{entry.title}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{entry.description}</p>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-end pt-2">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cerrar
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
