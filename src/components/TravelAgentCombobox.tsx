"use client";

import { useMemo, useState } from "react";
import { TravelAgent } from "@/types";
import { CreateTravelAgentDialog } from "@/components/CreateTravelAgentDialog";

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function TravelAgentCombobox({
  travelAgents,
  name,
  defaultValue,
  onTravelAgentSelected,
}: {
  travelAgents: TravelAgent[];
  name: string;
  defaultValue?: string;
  onTravelAgentSelected?: (agent: TravelAgent) => void;
}) {
  const defaultAgent = defaultValue
    ? travelAgents.find((a) => a.id === defaultValue)
    : undefined;
  const [query, setQuery] = useState(defaultAgent?.name ?? "");
  const [selectedId, setSelectedId] = useState(defaultAgent?.id ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [allAgents, setAllAgents] = useState<TravelAgent[]>(travelAgents);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const selectedAgent = allAgents.find((a) => a.id === selectedId);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return allAgents.filter((a) => normalize(a.name).includes(q)).slice(0, 8);
  }, [allAgents, query]);

  function handleSelect(agent: TravelAgent) {
    setQuery(agent.name);
    setSelectedId(agent.id);
    setIsOpen(false);
    onTravelAgentSelected?.(agent);
  }

  function handleChange(value: string) {
    setQuery(value);
    setSelectedId("");
    setIsOpen(true);
  }

  function handleAgentCreated(agent: TravelAgent) {
    setAllAgents((prev) => [agent, ...prev]);
    handleSelect(agent);
    setShowCreateDialog(false);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="Buscar agente…"
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        autoComplete="off"
      />
      <input type="hidden" name={name} value={selectedId} />

      {isOpen && (
        <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-md">
          {results.length === 0 && query.trim() && (
            <li className="px-3 py-2 text-sm text-gray-400">Sin resultados</li>
          )}
          {results.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(a)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-medium">{a.name}</span>
                {a.email && <span className="ml-2 text-xs text-gray-400">{a.email}</span>}
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
              + Crear nuevo agente
            </button>
          </li>
        </ul>
      )}

      {selectedAgent && !isOpen && (
        <div className="mt-1 text-xs text-gray-500">
          {selectedAgent.email && <p>{selectedAgent.email}</p>}
          {selectedAgent.phone && <p>{selectedAgent.phone}</p>}
        </div>
      )}

      <CreateTravelAgentDialog
        key={showCreateDialog ? "create-open" : "create-closed"}
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={handleAgentCreated}
      />
    </div>
  );
}
