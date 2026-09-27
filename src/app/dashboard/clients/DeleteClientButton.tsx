"use client";

import { useRef } from "react";

export function DeleteClientButton({
  clientName,
  action,
}: {
  clientName: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const confirmationRef = useRef<HTMLInputElement>(null);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmation = window.prompt(
          `Para eliminar a ${clientName}, escribe exactamente su nombre. Esta acción no elimina sus viajes.`
        );
        if (confirmation !== clientName) {
          event.preventDefault();
          return;
        }
        if (confirmationRef.current) confirmationRef.current.value = confirmation;
      }}
    >
      <input ref={confirmationRef} type="hidden" name="confirmationName" />
      <button
        type="submit"
        className="rounded-lg border border-[var(--operator-coral)]/40 px-3 py-1.5 text-xs font-medium text-[var(--operator-coral)] hover:bg-[var(--operator-coral)]/10 dark:border-[var(--operator-coral)]/40 dark:text-[var(--operator-coral)] dark:hover:bg-[var(--operator-coral)]/10"
        aria-label={`Eliminar cliente ${clientName}`}
      >
        Eliminar
      </button>
    </form>
  );
}
