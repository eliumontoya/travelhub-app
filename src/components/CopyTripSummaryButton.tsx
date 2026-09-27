"use client";

import { useState } from "react";
import { TripWithDetails } from "@/types";
import { buildTripSummary } from "@/lib/trip-summary";

export function CopyTripSummaryButtonClient({ trip }: { trip: TripWithDetails }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const publicUrl = `${window.location.origin}/t/${trip.slug}`;
    const summary = buildTripSummary(trip, publicUrl);
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-lg border border-[var(--operator-border)] px-4 py-2 text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
    >
      {copied ? "¡Copiado!" : "Copiar resumen"}
    </button>
  );
}
