"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { VisaStatus } from "@/types";
import { transitionVisaStatusAction } from "./actions";

const STATUS_LABEL: Record<VisaStatus, string> = {
  pending: "Pendiente",
  in_progress: "En trámite",
  completed: "Completada",
};

const NEXT_STATUS_LABEL: Record<VisaStatus, string> = {
  pending: "Avanzar a en trámite",
  in_progress: "Marcar como completada",
  completed: "Visa completada",
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
        setError(result.error ?? "No se pudo cambiar el estado.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3" data-testid="visa-status-control">
      <p className="text-sm text-[var(--operator-ink-muted)]">
        Estado actual: <span className="font-semibold text-[var(--operator-ink)]">{STATUS_LABEL[currentStatus]}</span>
      </p>
      {next ? (
        <button
          type="button"
          onClick={handleAdvance}
          disabled={isPending}
          data-testid="visa-advance-button"
          className="rounded-lg bg-[var(--operator-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--operator-brand-strong)] disabled:opacity-60"
        >
          {isPending ? "Actualizando…" : NEXT_STATUS_LABEL[next]}
        </button>
      ) : (
        <p className="text-sm text-[var(--operator-ink-muted)]">
          Esta visa ya está completada; no hay más cambios de estado disponibles.
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
