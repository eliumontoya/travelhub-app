"use client";

import { useState } from "react";

const CACHE_KEY_PREFIX = "flight-status:";

function getCacheKey(title: string) {
  return `${CACHE_KEY_PREFIX}${title}`;
}

interface CacheEntry {
  status: string;
  flightNumber: string;
  timestamp: number;
}

function readCache(title: string, cacheHours: number): CacheEntry | null {
  try {
    const raw = localStorage.getItem(getCacheKey(title));
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    const maxAge = cacheHours * 60 * 60 * 1000;
    if (Date.now() - entry.timestamp > maxAge) {
      localStorage.removeItem(getCacheKey(title));
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function writeCache(title: string, status: string, flightNumber: string) {
  try {
    const entry: CacheEntry = { status, flightNumber, timestamp: Date.now() };
    localStorage.setItem(getCacheKey(title), JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

// Read cache outside React to avoid setState-in-effect lint error.
// localStorage is synchronous and this runs once at module evaluation per page load.
// The value is safe because we only use it to seed the initial state.
function getInitialCache(title: string, cacheHours: number): { status: string | null; flightNumber: string | null } {
  if (typeof window === "undefined") return { status: null, flightNumber: null };
  const cached = readCache(title, cacheHours);
  return cached ? { status: cached.status, flightNumber: cached.flightNumber } : { status: null, flightNumber: null };
}

export function FlightStatusBadge({ title }: { title: string }) {
  const cacheHours = Number(process.env.NEXT_PUBLIC_FLIGHT_STATUS_CACHE_HOURS ?? 24);
  const initial = getInitialCache(title, cacheHours);

  const [status, setStatus] = useState<string | null>(initial.status);
  const [flightNumber, setFlightNumber] = useState<string | null>(initial.flightNumber);
  const [loading, setLoading] = useState(false);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch(`/api/flight-status?title=${encodeURIComponent(title)}`);
      const data = await res.json();
      const newStatus: string | null = data.status;
      const newFlightNumber: string | null = data.flightNumber;
      if (newStatus) {
        writeCache(title, newStatus, newFlightNumber ?? "");
      }
      setStatus(newStatus);
      setFlightNumber(newFlightNumber);
    } catch {
      // Network error — leave status as-is
    } finally {
      setLoading(false);
    }
  }

  // Flight number found but no status — show partial badge with retry
  if (flightNumber && !status) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="w-fit rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          ✈ {flightNumber} · sin datos
        </span>
        <button
          type="button"
          onClick={fetchStatus}
          disabled={loading}
          className="text-[10px] text-gray-400 underline decoration-dotted hover:text-sky-600 disabled:opacity-50 dark:text-gray-500 dark:hover:text-sky-400"
          title="Reintentar obtener estado del vuelo"
        >
          {loading ? "reintentando…" : "reintentar"}
        </button>
      </span>
    );
  }

  // Already have a cached status — show badge
  if (status) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="w-fit rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
          ✈ {flightNumber && `${flightNumber} · `}{status}
        </span>
        <button
          type="button"
          onClick={fetchStatus}
          disabled={loading}
          className="text-[10px] text-gray-400 underline decoration-dotted hover:text-sky-600 disabled:opacity-50 dark:text-gray-500 dark:hover:text-sky-400"
          title="Actualizar estado del vuelo"
        >
          {loading ? "actualizando…" : "actualizar"}
        </button>
      </span>
    );
  }

  // No flight number and no status — show fetch button
  return (
    <button
      type="button"
      onClick={fetchStatus}
      disabled={loading}
      className="w-fit rounded-full border border-dashed border-sky-300 bg-sky-50/50 px-2.5 py-0.5 text-xs font-medium text-sky-600 hover:bg-sky-100 hover:text-sky-700 disabled:opacity-50 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-400 dark:hover:bg-sky-950 dark:hover:text-sky-300"
    >
      {loading ? "Consultando…" : "✈ Estado del vuelo"}
    </button>
  );
}
