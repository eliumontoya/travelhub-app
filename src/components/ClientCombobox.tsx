"use client";

import { useMemo, useState } from "react";
import { Client } from "@/types";
import { CreateClientDialog } from "@/components/CreateClientDialog";

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function ClientCombobox({
  clients,
  name,
  defaultValue,
}: {
  clients: Client[];
  name: string;
  defaultValue?: string;
}) {
  const defaultClient = defaultValue ? clients.find((c) => c.id === defaultValue) : undefined;
  const [query, setQuery] = useState(defaultClient?.name ?? "");
  const [selectedId, setSelectedId] = useState(defaultClient?.id ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [allClients, setAllClients] = useState<Client[]>(clients);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return allClients.filter((c) => normalize(c.name).includes(q)).slice(0, 8);
  }, [allClients, query]);

  function handleSelect(client: Client) {
    setQuery(client.name);
    setSelectedId(client.id);
    setIsOpen(false);
  }

  function handleChange(value: string) {
    setQuery(value);
    setSelectedId("");
    setIsOpen(true);
  }

  function handleClientCreated(client: Client) {
    setAllClients((prev) => [client, ...prev]);
    setQuery(client.name);
    setSelectedId(client.id);
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="Buscar cliente por nombre…"
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        autoComplete="off"
      />
      <input type="hidden" name={name} value={selectedId} />

      {isOpen && (
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
          <li className="border-t border-gray-100">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setShowCreateDialog(true);
              }}
              className="block w-full px-3 py-2 text-left text-sm font-medium text-blue-600 hover:bg-blue-50"
            >
              + Crear nuevo
            </button>
          </li>
        </ul>
      )}

      <CreateClientDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={handleClientCreated}
      />
    </div>
  );
}
