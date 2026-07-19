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
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
        <p className="text-sm text-gray-700">¡Gracias por tu comentario!</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <h3 className="text-sm font-semibold text-gray-900">¿Cómo estuvo tu viaje?</h3>
      <input type="hidden" name="rating" value={rating} />
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            aria-label={`Calificar ${value} de 5`}
            className={`text-2xl leading-none ${value <= rating ? "text-amber-400" : "text-gray-300"}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        name="comment"
        rows={3}
        placeholder="Cuéntanos algo más (opcional)"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={isPending || rating === 0}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Enviar
      </button>
    </form>
  );
}
