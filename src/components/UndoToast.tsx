"use client";

import { useEffect, useState } from "react";

type UndoToastPayload = {
  message: string;
  onUndo: () => Promise<void> | void;
  durationMs?: number;
};

type Listener = (payload: UndoToastPayload) => void;

let listeners: Listener[] = [];

export function showUndoToast(payload: UndoToastPayload) {
  listeners.forEach((listener) => listener(payload));
}

// Host único (montado una vez por página) para el toast "Deshacer" del
// soft delete de días/items (issue #23). No usa contexto/provider: un bus de
// eventos a nivel de módulo es suficiente porque solo hay un toast visible a
// la vez y evita envolver el árbol de la página en un provider extra.
export function UndoToastHost() {
  const [toast, setToast] = useState<UndoToastPayload | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const listener: Listener = (payload) => {
      setPending(false);
      setToast(payload);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.durationMs ?? 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  async function handleUndo() {
    if (!toast) return;
    setPending(true);
    await toast.onUndo();
    setPending(false);
    setToast(null);
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={handleUndo}
        disabled={pending}
        className="font-semibold text-blue-300 hover:underline disabled:opacity-50"
      >
        Deshacer
      </button>
    </div>
  );
}
