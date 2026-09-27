"use client";

import { useFormStatus } from "react-dom";

export function TripPublishSubmitButton({ isPublished }: { isPublished: boolean }) {
  const { pending } = useFormStatus();
  const idleLabel = isPublished ? "Pasar a borrador" : "Publicar";
  const pendingLabel = isPublished ? "Pasando a borrador…" : "Publicando…";

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      aria-busy={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-[var(--operator-brand-strong)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--operator-brand)] disabled:cursor-not-allowed disabled:bg-[var(--operator-border)] disabled:opacity-80 dark:bg-[var(--operator-surface-subtle)] dark:text-[var(--operator-brand)] dark:hover:bg-white dark:disabled:bg-[var(--operator-border)]"
    >
      {pending && (
        <span
          aria-hidden="true"
          className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      <span aria-live="polite">{pending ? pendingLabel : idleLabel}</span>
    </button>
  );
}
