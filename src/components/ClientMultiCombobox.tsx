"use client";

import { useMemo, useState } from "react";
import { Client } from "@/types";

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Variante multi-select de ClientCombobox: permite seleccionar 2+ clientes
// existentes. Renderiza cada cliente seleccionado como un chip removible y
// emite un <input type="hidden" name={name}> POR cada id seleccionado, para
// que formData.getAll(name) devuelva el arreglo completo sin de-dup.
export function ClientMultiCombobox({
  clients,
  name,
  selectedIds,
  onSelectionChange,
}: {
  clients: Client[];
  name: string;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedClients = useMemo(
    () =>
      selectedIds
        .map((id) => clients.find((c) => c.id === id))
        .filter((c): c is Client => Boolean(c)),
    [clients, selectedIds]
  );

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return clients
      .filter((c) => !selectedIds.includes(c.id))
      .filter((c) => normalize(c.name).includes(q))
      .slice(0, 8);
  }, [clients, query, selectedIds]);

  function handleSelect(client: Client) {
    onSelectionChange(selectedIds.includes(client.id) ? selectedIds : [...selectedIds, client.id]);
    setQuery("");
    setIsOpen(false);
  }

  function handleRemove(clientId: string) {
    onSelectionChange(selectedIds.filter((id) => id !== clientId));
  }

  return (
    <div>
      {selectedClients.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {selectedClients.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700"
            >
              {c.name}
              <button
                type="button"
                onClick={() => handleRemove(c.id)}
                aria-label={`Quitar ${c.name}`}
                className="text-blue-400 hover:text-blue-600"
              >
                ×
              </button>
              <input type="hidden" name={name} value={c.id} />
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          placeholder="Buscar cliente por nombre…"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          autoComplete="off"
        />

        {isOpen && results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-md">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(c)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
