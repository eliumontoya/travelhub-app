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
        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
        aria-label={`Eliminar cliente ${clientName}`}
      >
        Eliminar
      </button>
    </form>
  );
}
