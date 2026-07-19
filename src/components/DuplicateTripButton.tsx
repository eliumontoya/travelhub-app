"use client";

import { useTransition } from "react";

export function DuplicateTripButton({ onDuplicate }: { onDuplicate: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(onDuplicate)}
      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {isPending ? "Duplicando..." : "Duplicar viaje"}
    </button>
  );
}
