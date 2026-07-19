"use client";

import { useTransition } from "react";

const LARGE_RANGE_THRESHOLD = 60;

export function GenerateDaysButton({
  totalDays,
  onGenerate,
}: {
  totalDays: number;
  onGenerate: () => Promise<{ ok: boolean; message: string }>;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (totalDays > LARGE_RANGE_THRESHOLD) {
      const confirmed = confirm(
        `El viaje abarca ${totalDays} días. ¿Confirmas generar todos los días faltantes?`
      );
      if (!confirmed) return;
    }
    startTransition(async () => {
      const result = await onGenerate();
      alert(result.message);
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleClick}
      className="w-full rounded-lg border border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50"
    >
      {isPending ? "Generando..." : "Generar días"}
    </button>
  );
}
