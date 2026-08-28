"use client";

import { useState } from "react";

const CACHE_KEY_PREFIX = "flight-status:";

function normalizeFlightNumber(flightNumber: string | null | undefined): string | null {
  const normalized = flightNumber?.trim().toUpperCase().replace(/\s+/g, "") ?? "";
  return normalized || null;
}

function getCacheKey(flightNumber: string) {
  return `${CACHE_KEY_PREFIX}${flightNumber}`;
}

interface CacheEntry {
  status: string;
  flightNumber: string;
  timestamp: number;
}

function readCache(flightNumber: string | null, cacheHours: number): CacheEntry | null {
  if (!flightNumber) return null;

  try {
    const raw = localStorage.getItem(getCacheKey(flightNumber));
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    const maxAge = cacheHours * 60 * 60 * 1000;
    if (Date.now() - entry.timestamp > maxAge) {
      localStorage.removeItem(getCacheKey(flightNumber));
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function writeCache(status: string, flightNumber: string) {
  try {
    const entry: CacheEntry = { status, flightNumber, timestamp: Date.now() };
    localStorage.setItem(getCacheKey(flightNumber), JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function getInitialCache(
  flightNumber: string | null,
  cacheHours: number,
): { status: string | null; flightNumber: string | null } {
  if (typeof window === "undefined") return { status: null, flightNumber };
  const cached = readCache(flightNumber, cacheHours);
  return cached ? { status: cached.status, flightNumber: cached.flightNumber } : { status: null, flightNumber };
}

export function FlightStatusBadge({ flightNumber: initialFlightNumber }: { flightNumber?: string | null }) {
  const cacheHours = Number(process.env.NEXT_PUBLIC_FLIGHT_STATUS_CACHE_HOURS ?? 24);
  const explicitFlightNumber = normalizeFlightNumber(initialFlightNumber);
  const initial = getInitialCache(explicitFlightNumber, cacheHours);

  const [status, setStatus] = useState<string | null>(initial.status);
  const [flightNumber, setFlightNumber] = useState<string | null>(initial.flightNumber);
  const [loading, setLoading] = useState(false);

  if (!explicitFlightNumber) {
    return (
      <span className="w-fit rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-400 dark:bg-gray-900 dark:text-gray-500">
        ✈ sin número de vuelo
      </span>
    );
  }

  const requestFlightNumber = explicitFlightNumber;

  async function fetchStatus() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ flightNumber: requestFlightNumber });
      const res = await fetch(`/api/flight-status?${params.toString()}`);
      const data = await res.json();
      const newStatus: string | null = data.status;
      const newFlightNumber: string | null = data.flightNumber;
      if (newStatus && newFlightNumber) {
        writeCache(newStatus, newFlightNumber);
      }
      setStatus(newStatus);
      setFlightNumber(newFlightNumber ?? requestFlightNumber);
    } catch {
      // Network error — leave status as-is
    } finally {
      setLoading(false);
    }
  }

  if (flightNumber && !status) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="w-fit rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          ✈ {flightNumber} · sin consultar
        </span>
        <button
          type="button"
          onClick={fetchStatus}
          disabled={loading}
          className="text-[10px] text-gray-400 underline decoration-dotted hover:text-sky-600 disabled:opacity-50 dark:text-gray-500 dark:hover:text-sky-400"
          title="Consultar estado del vuelo"
        >
          {loading ? "consultando…" : "consultar"}
        </button>
      </span>
    );
  }

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

  return null;
}
