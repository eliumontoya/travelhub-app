"use client";

import { useTransition } from "react";

export function DuplicateTripButton({ onDuplicate }: { onDuplicate: () => Promise<void> }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(onDuplicate)}
      className="rounded-lg border border-[var(--operator-border)] px-4 py-2 text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] disabled:opacity-50"
    >
      {isPending ? "Duplicando..." : "Duplicar viaje"}
    </button>
  );
}
