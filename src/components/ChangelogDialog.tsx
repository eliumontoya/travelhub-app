"use client";

import { useRef } from "react";
import { changelog } from "@/lib/changelog";

export function ChangelogDialog() {
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
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
      >
        Qué hay de nuevo
      </button>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
      >
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Qué hay de nuevo</h3>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar"
              className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-50"
            >
              ✕
            </button>
          </div>

          <ul className="max-h-96 space-y-4 overflow-y-auto">
            {changelog.map((entry) => (
              <li key={entry.date + entry.title} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <p className="text-xs text-gray-400">{entry.date}</p>
                <p className="text-sm font-medium text-gray-900">{entry.title}</p>
                <p className="mt-1 text-sm text-gray-600">{entry.description}</p>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-end pt-2">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
