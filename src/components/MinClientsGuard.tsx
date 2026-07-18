"use client";

import { useEffect, useRef, useState } from "react";

// Guardia cliente-side de "mínimo 1 cliente": intercepta el submit del
// <form> ancestro (el más cercano) y bloquea el envío si no hay al menos un
// input[name={fieldName}] presente (ClientMultiCombobox emite uno por cada
// cliente seleccionado). Complementa la validación servidor-side existente
// en createTripAction/setTripClientsAction (defensa en profundidad, no
// reemplaza la validación del server).
export function MinClientsGuard({ fieldName }: { fieldName: string }) {
  const markerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const form = markerRef.current?.closest("form");
    if (!form) return;

    function handleSubmit(e: Event) {
      const count = form!.querySelectorAll(`input[name="${fieldName}"]`).length;
      const newClientName = (form!.querySelector('input[name="newClientName"]') as HTMLInputElement)?.value?.trim();
      if (count < 1 && !newClientName) {
        e.preventDefault();
        setError("Selecciona al menos un cliente o creá uno nuevo");
      } else {
        setError(null);
      }
    }

    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, [fieldName]);

  return <div ref={markerRef}>{error && <p className="text-sm text-red-600">{error}</p>}</div>;
}
