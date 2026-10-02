"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { VisaStatus } from "@/types";
import { transitionVisaStatusAction } from "./actions";

const STATUS_LABEL: Record<VisaStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
};

const NEXT_STATUS_LABEL: Record<VisaStatus, string> = {
  pending: "Advance to in progress",
  in_progress: "Mark as completed",
  completed: "Visa completed",
};

export function VisaStatusControl({
  visaId,
  currentStatus,
  allowedTransitions,
}: {
  visaId: string;
  currentStatus: VisaStatus;
  allowedTransitions: VisaStatus[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const next = allowedTransitions[0] ?? null;

  function handleAdvance() {
    if (!next) return;
    setError(null);
    startTransition(async () => {
      const result = await transitionVisaStatusAction(visaId, next);
      if (!result.ok) {
        setError(result.error ?? "Could not transition status.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3" data-testid="visa-status-control">
      <p className="text-sm text-[var(--operator-ink-muted)]">
        Current status: <span className="font-semibold text-[var(--operator-ink)]">{STATUS_LABEL[currentStatus]}</span>
      </p>
      {next ? (
        <button
          type="button"
          onClick={handleAdvance}
          disabled={isPending}
          data-testid="visa-advance-button"
          className="rounded-lg bg-[var(--operator-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--operator-brand-strong)] disabled:opacity-60"
        >
          {isPending ? "Updating…" : NEXT_STATUS_LABEL[next]}
        </button>
      ) : (
        <p className="text-sm text-[var(--operator-ink-muted)]">
          This visa is in a terminal state; no further transitions are allowed.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-[var(--operator-coral)]">
          {error}
        </p>
      )}
    </div>
  );
}
