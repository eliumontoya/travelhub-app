"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Trip } from "@/types";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export function TripCommissionDialog({
  trigger,
  trip,
  onSubmit,
}: {
  trigger: React.ReactNode;
  trip: Trip;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [salePrice, setSalePrice] = useState(trip.salePrice?.toString() ?? "");
  const [commissionRate, setCommissionRate] = useState(trip.commissionRate?.toString() ?? "");

  const commissionAmount = (() => {
    const price = Number(salePrice);
    const rate = Number(commissionRate);
    if (!salePrice || !commissionRate || Number.isNaN(price) || Number.isNaN(rate)) return null;
    return (price * rate) / 100;
  })();

  function open() {
    setError(null);
    setSalePrice(trip.salePrice?.toString() ?? "");
    setCommissionRate(trip.commissionRate?.toString() ?? "");
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await onSubmit(formData);
        router.refresh();
        close();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudieron guardar los cambios.");
      }
    });
  }

  return (
    <>
      <span onClick={open}>{trigger}</span>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-[var(--operator-border)] p-0 backdrop:bg-black/40"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <h3 className="text-lg font-semibold text-[var(--operator-brand)]">Comisión del viaje</h3>
          <p className="text-xs text-[var(--operator-ink-muted)]">
            Solo visible aquí, en el editor del agente. Nunca se muestra en la vista pública del
            viaje.
          </p>

          <div>
            <label className="block text-sm font-medium text-[var(--operator-ink)]">Precio de venta</label>
            <input
              type="number"
              name="salePrice"
              min="0"
              step="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--operator-ink)]">Comisión (%)</label>
            <input
              type="number"
              name="commissionRate"
              min="0"
              max="100"
              step="0.01"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
              placeholder="0.00"
            />
          </div>

          <div className="rounded-lg bg-[var(--operator-canvas)] px-3 py-2">
            <span className="block text-xs font-medium text-[var(--operator-ink-muted)]">Comisión calculada</span>
            <span className="text-lg font-semibold text-[var(--operator-brand)]">
              {commissionAmount !== null ? currencyFormatter.format(commissionAmount) : "—"}
            </span>
          </div>

          {error && <p className="text-sm text-[var(--operator-coral)]">{error}</p>}

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
              Guardar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
