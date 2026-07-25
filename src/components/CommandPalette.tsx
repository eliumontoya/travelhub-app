"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PaletteClient = { id: string; name: string };
type PaletteTrip = { id: string; title: string };

type PaletteResult =
  | { kind: "client"; id: string; label: string; href: string }
  | { kind: "trip"; id: string; label: string; href: string };

export function CommandPalette({
  clients,
  trips,
}: {
  clients: PaletteClient[];
  trips: PaletteTrip[];
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const allResults = useMemo<PaletteResult[]>(
    () => [
      ...clients.map((c) => ({
        kind: "client" as const,
        id: c.id,
        label: c.name,
        href: `/dashboard/clients/${c.id}`,
      })),
      ...trips.map((t) => ({
        kind: "trip" as const,
        id: t.id,
        label: t.title,
        href: `/dashboard/trips/${t.id}`,
      })),
    ],
    [clients, trips]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allResults.slice(0, 20);
    return allResults.filter((r) => r.label.toLowerCase().includes(q)).slice(0, 20);
  }, [allResults, query]);

  function closePalette() {
    dialogRef.current?.close();
    setOpen(false);
  }

  function select(result: PaletteResult) {
    closePalette();
    router.push(result.href);
  }

  useEffect(() => {
    if (open && dialogRef.current && !dialogRef.current.open) {
      setQuery("");
      setActiveIndex(0);
      dialogRef.current.showModal();
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const picked = results[activeIndex];
      if (picked) select(picked);
    } else if (e.key === "Escape") {
      closePalette();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={() => setOpen(false)}
      className="w-full max-w-lg rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
    >
      <div className="p-3">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
          onKeyDown={handleInputKeyDown}
          placeholder="Buscar cliente o viaje…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <ul className="mt-2 max-h-80 overflow-y-auto">
          {results.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-gray-400">Sin resultados</li>
          )}
          {results.map((result, index) => (
            <li key={`${result.kind}-${result.id}`}>
              <button
                type="button"
                onClick={() => select(result)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                  index === activeIndex ? "bg-blue-50 text-blue-700" : "text-gray-700"
                }`}
              >
                <span>{result.label}</span>
                <span className="text-xs text-gray-400">
                  {result.kind === "client" ? "Cliente" : "Viaje"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
