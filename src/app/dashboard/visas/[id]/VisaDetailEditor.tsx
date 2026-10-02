"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Visa } from "@/types";
import { updateVisaAction } from "./actions";

export function VisaDetailEditor({ visa }: { visa: Visa }) {
  const router = useRouter();
  const [country, setCountry] = useState(visa.country);
  const [visaType, setVisaType] = useState(visa.visaType);
  const [deadline, setDeadline] = useState(visa.deadline);
  const [price, setPrice] = useState(String(visa.price));
  const [notes, setNotes] = useState(visa.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set("country", country);
    formData.set("visaType", visaType);
    formData.set("deadline", deadline);
    formData.set("price", price);
    formData.set("notes", notes);

    startTransition(async () => {
      const result = await updateVisaAction(visa.id, formData);
      if (!result.ok) {
        setError(result.error ?? "No se pudo actualizar la visa.");
        return;
      }
      setSuccess("Visa actualizada.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="visa-edit-form">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="visa-detail-country"
            className="block text-xs font-semibold uppercase tracking-wider text-[var(--operator-ink-muted)]"
          >
            País / consulado
          </label>
          <input
            id="visa-detail-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="visa-detail-type"
            className="block text-xs font-semibold uppercase tracking-wider text-[var(--operator-ink-muted)]"
          >
            Tipo de visa
          </label>
          <input
            id="visa-detail-type"
            value={visaType}
            onChange={(e) => setVisaType(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="visa-detail-deadline"
            className="block text-xs font-semibold uppercase tracking-wider text-[var(--operator-ink-muted)]"
          >
            Fecha límite
          </label>
          <input
            id="visa-detail-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="visa-detail-price"
            className="block text-xs font-semibold uppercase tracking-wider text-[var(--operator-ink-muted)]"
          >
            Precio
          </label>
          <input
            id="visa-detail-price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            min={0}
            step="0.01"
            required
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="visa-detail-notes"
          className="block text-xs font-semibold uppercase tracking-wider text-[var(--operator-ink-muted)]"
        >
          Notas
        </label>
        <textarea
          id="visa-detail-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--operator-coral)]">
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="text-sm text-green-700"
          data-testid="visa-edit-success"
        >
          {success}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-[var(--operator-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--operator-brand-strong)] disabled:opacity-60"
        >
          {isPending ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
