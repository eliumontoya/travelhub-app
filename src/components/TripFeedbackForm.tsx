"use client";

import { useState, useTransition } from "react";

export function TripFeedbackForm({
  onSubmit,
}: {
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [rating, setRating] = useState(0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rating) return;
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await onSubmit(formData);
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-[var(--operator-border)] bg-white p-4 text-center shadow-sm">
        <p className="text-sm text-[var(--operator-ink)]">¡Gracias por tu comentario!</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-[var(--operator-border)] bg-white p-4 shadow-sm"
    >
      <h3 className="text-sm font-semibold text-[var(--operator-brand)]">¿Cómo estuvo tu viaje?</h3>
      <input type="hidden" name="rating" value={rating} />
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            aria-label={`Calificar ${value} de 5`}
            className={`text-2xl leading-none ${value <= rating ? "text-[var(--operator-gold)]" : "text-[var(--operator-ink-subtle)]"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        name="comment"
        rows={3}
        placeholder="Cuéntanos algo más (opcional)"
        className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={isPending || rating === 0}
        className="rounded-lg bg-[var(--operator-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--operator-brand-strong)] disabled:opacity-50"
      >
        Enviar
      </button>
    </form>
  );
}
