"use client";

import { useTransition } from "react";

export function ReorderButtons({
  onMoveUp,
  onMoveDown,
  disableUp,
  disableDown,
}: {
  onMoveUp: () => Promise<void>;
  onMoveDown: () => Promise<void>;
  disableUp?: boolean;
  disableDown?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col">
      <button
        type="button"
        disabled={disableUp || isPending}
        onClick={() => startTransition(onMoveUp)}
        className="px-1 text-xs text-[var(--operator-ink-subtle)] hover:text-[var(--operator-ink)] disabled:opacity-25"
        aria-label="Mover arriba"
      >
        ▲
      </button>
      <button
        type="button"
        disabled={disableDown || isPending}
        onClick={() => startTransition(onMoveDown)}
        className="px-1 text-xs text-[var(--operator-ink-subtle)] hover:text-[var(--operator-ink)] disabled:opacity-25"
        aria-label="Mover abajo"
      >
        ▼
      </button>
    </div>
  );
}
