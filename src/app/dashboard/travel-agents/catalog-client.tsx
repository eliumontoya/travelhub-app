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
          className="rounded-xl bg-[var(--operator-brand)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--operator-shadow-action)] hover:bg-[var(--operator-brand-strong)]"
        >
          + Nuevo agente
        </button>
      </div>

      {agents.length === 0 ? (
        <div className="rounded-2xl border border-[var(--operator-border)] bg-white/94 p-8 text-center shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
          <p className="text-[var(--operator-ink-muted)]">
            Aún no hay agentes de viajes. ¡Crea el primero!
          </p>
          <button
            type="button"
            onClick={() => setShowCreateDialog(true)}
            className="mt-3 rounded-xl bg-[var(--operator-brand)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--operator-shadow-action)] hover:bg-[var(--operator-brand-strong)]"
          >
            Crear primer agente
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--operator-border)] bg-white/94 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--operator-surface-subtle)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[var(--operator-ink-muted)]">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--operator-ink-muted)]">Email</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--operator-ink-muted)]">Teléfono</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--operator-ink-muted)]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--operator-border)]">
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-[var(--operator-surface-subtle)]">
                  <td className="px-4 py-3 font-semibold text-[var(--operator-brand)]">{agent.name}</td>
                  <td className="px-4 py-3 text-[var(--operator-ink-muted)]">{agent.email || "—"}</td>
                  <td className="px-4 py-3 text-[var(--operator-ink-muted)]">{agent.phone || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditingAgent(agent)}
                      className="mr-2 text-sm text-[var(--operator-brand)] hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(agent)}
                      className="text-sm text-[var(--operator-coral)] hover:underline"
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
