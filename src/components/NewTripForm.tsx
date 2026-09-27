"use client";

import { useState } from "react";
import { Client, Tag, TravelAgent, Trip } from "@/types";
import { createTripAction } from "@/app/dashboard/trips/new/actions";
import { ClientMultiCombobox } from "@/components/ClientMultiCombobox";
import { MinClientsGuard } from "@/components/MinClientsGuard";
import { RichTextEditor } from "@/components/RichTextEditor";
import { TagMultiCombobox } from "@/components/TagMultiCombobox";
import { TravelAgentCombobox } from "@/components/TravelAgentCombobox";

export function NewTripForm({
  clients,
  tags,
  templates,
  travelAgents,
  error,
  clientId,
}: {
  clients: Client[];
  tags: Tag[];
  templates: Trip[];
  travelAgents: TravelAgent[];
  error?: string;
  clientId?: string;
}) {
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(
    clientId ? [clientId] : []
  );

  return (
    <form action={createTripAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--operator-ink)]">Título</label>
        <input
          name="title"
          required
          className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          placeholder="Luna de miel en Italia"
        />
      </div>

      <div>
            <label className="block text-sm font-medium text-[var(--operator-ink)]">Instrucciones</label>
            <RichTextEditor
              name="instructions"
              placeholder="Mensaje de bienvenida, instrucciones de llegada, contactos de emergencia…"
            />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[var(--operator-ink)]">Fecha inicio</label>
          <input
            type="date"
            name="startDate"
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--operator-ink)]">Fecha fin</label>
          <input
            type="date"
            name="endDate"
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          />
        </div>
      </div>

      {templates.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-[var(--operator-ink)]">Crear desde plantilla</label>
          <select
            name="templateId"
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          >
            <option value="">Ninguna (viaje en blanco)</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--operator-ink-subtle)]">
            Copia los días e items de la plantilla elegida a este viaje nuevo.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[var(--operator-ink)]"># Viajeros</label>
        <input
          type="number"
          name="travelerCount"
          min={1}
          defaultValue={1}
          className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--operator-ink)]">Moneda</label>
        <select
          name="currency"
          defaultValue="MXN"
          className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
        >
          <option value="MXN">MXN — Peso mexicano</option>
          <option value="USD">USD — Dólar estadounidense</option>
          <option value="EUR">EUR — Euro</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--operator-ink)]">Agente asignado</label>
        <TravelAgentCombobox
          travelAgents={travelAgents}
          name="assignedAgentId"
        />
        <p className="mt-1 text-xs text-[var(--operator-ink-subtle)]">Opcional. Puedes dejarlo vacío y asignarlo después.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--operator-ink)]">Clientes existentes</label>
        <ClientMultiCombobox
          clients={clients}
          name="clientIds"
          selectedIds={selectedClientIds}
          onSelectionChange={setSelectedClientIds}
        />
        <MinClientsGuard fieldName="clientIds" />
      </div>

      <fieldset className="rounded-lg border border-[var(--operator-border)] p-4">
        <legend className="px-1 text-sm font-medium text-[var(--operator-ink)]">O cliente nuevo</legend>
        <div className="space-y-3">
          <input
            name="newClientName"
            placeholder="Nombre"
            className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              name="newClientEmail"
              placeholder="Email"
              className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
            />
            <input
              name="newClientPhone"
              placeholder="Teléfono"
              className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
            />
          </div>
          <input
            name="newClientWhatsapp"
            placeholder="WhatsApp (opcional; usa teléfono si queda vacío)"
            className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          />
        </div>
      </fieldset>

      <div>
        <label className="block text-sm font-medium text-[var(--operator-ink)]">Tags</label>
        <TagMultiCombobox tags={tags} />
      </div>

      {error && <p className="text-sm text-[var(--operator-coral)]">{error}</p>}

      <button
        type="submit"
        className="w-full rounded-lg bg-[var(--operator-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--operator-brand-strong)]"
      >
        Crear viaje
      </button>
    </form>
  );
}
