"use client";

import { useRef, useState, useTransition } from "react";
import { Item, ItemDocument, ItemType } from "@/types";
import { itemTypeMeta } from "@/lib/item-meta";
import { LocationInput } from "@/components/LocationInput";
import { showUndoToast } from "@/components/UndoToast";

const itemTypes = Object.keys(itemTypeMeta) as ItemType[];

type MetadataFieldDef = {
  name: string;
  label: string;
  type: "text" | "time" | "date" | "select" | "textarea";
  options?: { value: string; label: string }[];
};

const metadataFieldsByType: Record<ItemType, MetadataFieldDef[]> = {
  flight: [
    { name: "airline", label: "Aerolínea", type: "text" },
    { name: "flightNumber", label: "Número de vuelo", type: "text" },
    { name: "departureAirport", label: "Aeropuerto de salida", type: "text" },
    { name: "arrivalAirport", label: "Aeropuerto de llegada", type: "text" },
    { name: "terminal", label: "Terminal", type: "text" },
    { name: "gate", label: "Puerta", type: "text" },
    { name: "seat", label: "Asiento", type: "text" },
    { name: "bookingReference", label: "Referencia de reserva", type: "text" },
  ],
  hotel: [
    { name: "hotelName", label: "Nombre del hotel", type: "text" },
    { name: "address", label: "Dirección", type: "text" },
    { name: "checkIn", label: "Check-in", type: "date" },
    { name: "checkOut", label: "Check-out", type: "date" },
    { name: "roomType", label: "Tipo de habitación", type: "text" },
    {
      name: "boardBasis",
      label: "Régimen",
      type: "select",
      options: [
        { value: "Solo alojamiento", label: "Solo alojamiento" },
        { value: "Desayuno incluido", label: "Desayuno incluido" },
        { value: "Media pensión", label: "Media pensión" },
        { value: "Pensión completa", label: "Pensión completa" },
        { value: "Todo incluido", label: "Todo incluido" },
      ],
    },
    { name: "bookingReference", label: "Referencia de reserva", type: "text" },
    { name: "hotelPhone", label: "Teléfono del hotel", type: "text" },
    { name: "specialRequests", label: "Solicitudes especiales", type: "textarea" },
  ],
  activity: [
    { name: "activityName", label: "Nombre de la actividad", type: "text" },
    { name: "provider", label: "Proveedor", type: "text" },
    { name: "address", label: "Dirección", type: "text" },
    { name: "duration", label: "Duración", type: "text" },
    { name: "ticketType", label: "Tipo de entrada", type: "text" },
    { name: "bookingReference", label: "Referencia de reserva", type: "text" },
    { name: "includes", label: "Incluye", type: "text" },
    { name: "meetingPoint", label: "Punto de encuentro", type: "text" },
  ],
  restaurant: [
    { name: "restaurantName", label: "Nombre del restaurante", type: "text" },
    { name: "address", label: "Dirección", type: "text" },
    { name: "cuisine", label: "Tipo de cocina", type: "text" },
    { name: "dressCode", label: "Código de vestimenta", type: "text" },
    { name: "reservationReference", label: "Referencia de reserva", type: "text" },
    { name: "phone", label: "Teléfono", type: "text" },
  ],
  transport: [
    { name: "company", label: "Empresa", type: "text" },
    { name: "pickupLocation", label: "Lugar de recogida", type: "text" },
    { name: "dropoffLocation", label: "Lugar de destino", type: "text" },
    { name: "pickupTime", label: "Hora de recogida", type: "text" },
    { name: "vehicleType", label: "Tipo de vehículo", type: "text" },
    { name: "driverName", label: "Nombre del conductor", type: "text" },
    { name: "driverPhone", label: "Teléfono del conductor", type: "text" },
    { name: "bookingReference", label: "Referencia de reserva", type: "text" },
  ],
  note: [],
};

function metadataDefaultValue(item: Item | undefined, fieldName: string): string | undefined {
  if (!item?.metadata) return undefined;
  const m = item.metadata as unknown as Record<string, unknown> | null;
  if (!m) return undefined;
  const val = m[fieldName];
  return typeof val === "string" ? val : undefined;
}

type DocWithUrl = ItemDocument & { url: string | null };

function DocumentPreview({ doc }: { doc: DocWithUrl }) {
  if (!doc.url) {
    return <span className="truncate text-gray-700">{doc.fileName}</span>;
  }

  if (doc.mimeType?.startsWith("image/")) {
    return (
      <a
        href={doc.url}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 items-center gap-2 text-blue-600 hover:underline"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={doc.url}
          alt={doc.fileName}
          className="h-8 w-8 shrink-0 rounded object-cover"
        />
        <span className="truncate">{doc.fileName}</span>
      </a>
    );
  }

  if (doc.mimeType === "application/pdf") {
    return (
      <a
        href={doc.url}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 items-center gap-2 text-blue-600 hover:underline"
      >
        <span aria-hidden className="shrink-0 text-lg">📄</span>
        <span className="truncate">{doc.fileName}</span>
      </a>
    );
  }

  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noreferrer"
      className="truncate text-blue-600 hover:underline"
    >
      {doc.fileName}
    </a>
  );
}

export function ItemFormDialog({
  trigger,
  item,
  onSubmit,
  onDelete,
  onUndoDelete,
  onLoadDocuments,
  onUploadDocument,
  onDeleteDocument,
  documentsEnabled,
}: {
  trigger: React.ReactNode;
  item?: Item;
  onSubmit: (formData: FormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onUndoDelete?: () => Promise<void>;
  onLoadDocuments?: () => Promise<DocWithUrl[]>;
  onUploadDocument?: (formData: FormData) => Promise<void>;
  onDeleteDocument?: (documentId: string) => Promise<void>;
  documentsEnabled?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocWithUrl[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<ItemType>(item?.type ?? "activity");

  function open() {
    setError(null);
    setSelectedType(item?.type ?? "activity");
    dialogRef.current?.showModal();
    if (item && onLoadDocuments) {
      setDocsLoading(true);
      onLoadDocuments()
        .then(setDocs)
        .finally(() => setDocsLoading(false));
    }
  }

  function close() {
    dialogRef.current?.close();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (!String(formData.get("title") ?? "").trim()) {
      setError("El título es obligatorio");
      return;
    }
    // Serialize metadata fields to JSON
    const mFields = metadataFieldsByType[selectedType];
    const metadataValues: Record<string, string> = {};
    let hasAnyValue = false;
    for (const field of mFields) {
      const val = String(formData.get(`metadata_${field.name}`) ?? "").trim();
      if (val) {
        metadataValues[field.name] = val;
        hasAnyValue = true;
      }
      formData.delete(`metadata_${field.name}`);
    }
    if (hasAnyValue) {
      formData.set("metadata", JSON.stringify(metadataValues));
    }
    startTransition(async () => {
      await onSubmit(formData);
      close();
    });
  }

  function handleDelete() {
    if (!onDelete) return;
    if (!confirm("¿Eliminar este item?")) return;
    startTransition(async () => {
      await onDelete();
      close();
      if (onUndoDelete) {
        showUndoToast({ message: "Item eliminado", onUndo: onUndoDelete });
      }
    });
  }

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !onUploadDocument) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      await onUploadDocument(formData);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (onLoadDocuments) setDocs(await onLoadDocuments());
    });
  }

  function handleDeleteDocument(documentId: string) {
    if (!onDeleteDocument) return;
    if (!confirm("¿Eliminar este documento?")) return;
    startTransition(async () => {
      await onDeleteDocument(documentId);
      if (onLoadDocuments) setDocs(await onLoadDocuments());
    });
  }

  return (
    <>
      <span onClick={open}>{trigger}</span>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <h3 className="text-lg font-semibold text-gray-900">
            {item ? "Editar item" : "Agregar item"}
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700">Tipo</label>
            <select
              name="type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as ItemType)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {itemTypes.map((t) => (
                <option key={t} value={t}>
                  {itemTypeMeta[t].icon} {itemTypeMeta[t].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Título</label>
            <input
              name="title"
              defaultValue={item?.title}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Hora inicio</label>
              <input
                type="time"
                name="startTime"
                defaultValue={item?.startTime}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Hora fin</label>
              <input
                type="time"
                name="endTime"
                defaultValue={item?.endTime}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Ubicación</label>
            <LocationInput
              defaultValue={item?.location}
              defaultLat={item?.lat}
              defaultLng={item?.lng}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Código de confirmación
              </label>
              <input
                name="confirmationCode"
                defaultValue={item?.confirmationCode}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Costo</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="cost"
                defaultValue={item?.cost}
                placeholder="Solo visible internamente salvo que actives el resumen de costos"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Notas</label>
            <textarea
              name="notes"
              defaultValue={item?.notes}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {selectedType !== "note" && metadataFieldsByType[selectedType].length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <h4 className="mb-3 text-sm font-semibold text-gray-800">
                {itemTypeMeta[selectedType].icon} Detalles de {itemTypeMeta[selectedType].label.toLowerCase()}
              </h4>
              <div className="space-y-3">
                {metadataFieldsByType[selectedType].map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-700">{field.label}</label>
                    {field.type === "textarea" ? (
                      <textarea
                        name={`metadata_${field.name}`}
                        defaultValue={metadataDefaultValue(item, field.name)}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    ) : field.type === "select" && field.options ? (
                      <select
                        name={`metadata_${field.name}`}
                        defaultValue={metadataDefaultValue(item, field.name) ?? ""}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="">Seleccionar...</option>
                        {field.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        name={`metadata_${field.name}`}
                        defaultValue={metadataDefaultValue(item, field.name)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {item && (
            <div className="border-t border-gray-100 pt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Documentos adjuntos
              </label>
              {docsLoading && <p className="text-sm text-gray-400">Cargando…</p>}
              {!docsLoading && docs.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {docs.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-2 text-sm">
                      <DocumentPreview doc={doc} />
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="shrink-0 text-xs text-red-600 hover:underline"
                      >
                        Eliminar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {documentsEnabled ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={fileInputRef} type="file" className="text-sm" />
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={isPending}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Subir
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  Configura Supabase para subir documentos.
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="text-sm text-red-600 hover:underline"
                >
                  Eliminar
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
