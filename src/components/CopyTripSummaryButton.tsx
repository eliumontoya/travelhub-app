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
      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      {copied ? "¡Copiado!" : "Copiar resumen"}
    </button>
  );
}
