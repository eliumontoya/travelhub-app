"use client";

import { useRef, useState, useTransition } from "react";
import { TripWithDetails } from "@/types";
import { sendItineraryEmailAction } from "@/app/dashboard/trips/[id]/actions";

export function SendItineraryEmailDialog({
  trigger,
  trip,
}: {
  trigger: React.ReactNode;
  trip: TripWithDetails;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const defaultRecipients = trip.clients.map((c) => c.email).filter(Boolean).join(", ");

  function open() {
    setResult(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setResult(null);
    startTransition(async () => {
      const res = await sendItineraryEmailAction(trip.id, formData);
      setResult(res);
      if (res.ok) {
        setTimeout(() => close(), 1200);
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
          <h3 className="text-lg font-semibold text-gray-900">Enviar itinerario por correo</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700">Destinatarios</label>
            <input
              name="recipients"
              defaultValue={defaultRecipients}
              placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-gray-400">Separados por coma.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Mensaje (opcional)</label>
            <textarea
              name="message"
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Un saludo o instrucciones para el cliente…"
            />
          </div>

          {result && (
            <p className={`text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}>
              {result.message}
            </p>
          )}

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
              {isPending ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
