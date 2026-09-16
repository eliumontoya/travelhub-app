"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TravelAgent } from "@/types";
import { CreateTravelAgentDialog } from "@/components/CreateTravelAgentDialog";
import {
  deleteTravelAgentAction,
} from "./actions";

export function TravelAgentCatalogClient({
  agents,
}: {
  agents: TravelAgent[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editingAgent, setEditingAgent] = useState<TravelAgent | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  function handleDelete(agent: TravelAgent) {
    if (!confirm(`¿Eliminar "${agent.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteTravelAgentAction(agent.id);
      if (!result.ok) {
        alert(result.error || "Error al eliminar");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setShowCreateDialog(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nuevo agente
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-gray-500 dark:text-gray-400">
            Aún no hay agentes de viajes. ¡Crea el primero!
          </p>
          <button
            type="button"
            onClick={() => setShowCreateDialog(true)}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Crear primer agente
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Teléfono</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{agent.name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{agent.email || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{agent.phone || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingAgent(agent)}
                      className="mr-2 text-sm text-blue-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(agent)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateTravelAgentDialog
        key={showCreateDialog ? "create-open" : "create-closed"}
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={() => {
          setShowCreateDialog(false);
          router.refresh();
        }}
      />

      <CreateTravelAgentDialog
        key={editingAgent?.id ?? "edit-closed"}
        open={editingAgent !== null}
        agent={editingAgent ?? undefined}
        onClose={() => setEditingAgent(null)}
        onUpdated={() => {
          setEditingAgent(null);
          router.refresh();
        }}
      />
    </div>
  );
}
