"use client";

import { useState } from "react";
import { Client, Tag, Trip } from "@/types";
import { createTripAction } from "@/app/dashboard/trips/new/actions";
import { ClientMultiCombobox } from "@/components/ClientMultiCombobox";
import { MinClientsGuard } from "@/components/MinClientsGuard";
import { TagMultiCombobox } from "@/components/TagMultiCombobox";

export function NewTripForm({
  clients,
  tags,
  templates,
  error,
  clientId,
}: {
  clients: Client[];
  tags: Tag[];
  templates: Trip[];
  error?: string;
  clientId?: string;
}) {
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(
    clientId ? [clientId] : []
  );

  return (
    <form action={createTripAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Título</label>
        <input
          name="title"
          required
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Luna de miel en Italia"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Instrucciones</label>
        <textarea
          name="instructions"
          rows={4}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Mensaje de bienvenida, instrucciones de llegada, contactos de emergencia…"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Fecha inicio</label>
          <input
            type="date"
            name="startDate"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Fecha fin</label>
          <input
            type="date"
            name="endDate"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {templates.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Crear desde plantilla</label>
          <select
            name="templateId"
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Ninguna (viaje en blanco)</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Copia los días e items de la plantilla elegida a este viaje nuevo.
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700"># Viajeros</label>
        <input
          type="number"
          name="travelerCount"
          min={1}
          defaultValue={1}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Moneda</label>
        <select
          name="currency"
          defaultValue="MXN"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="MXN">MXN — Peso mexicano</option>
          <option value="USD">USD — Dólar estadounidense</option>
          <option value="EUR">EUR — Euro</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Clientes existentes</label>
        <ClientMultiCombobox
          clients={clients}
          name="clientIds"
          selectedIds={selectedClientIds}
          onSelectionChange={setSelectedClientIds}
        />
        <MinClientsGuard fieldName="clientIds" />
      </div>

      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-1 text-sm font-medium text-gray-700">O cliente nuevo</legend>
        <div className="space-y-3">
          <input
            name="newClientName"
            placeholder="Nombre"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              name="newClientEmail"
              placeholder="Email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              name="newClientPhone"
              placeholder="Teléfono"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </fieldset>

      <div>
        <label className="block text-sm font-medium text-gray-700">Tags</label>
        <TagMultiCombobox tags={tags} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Crear viaje
      </button>
    </form>
  );
}
