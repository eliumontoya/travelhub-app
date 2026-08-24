"use client";

import { useRef, useState, useTransition } from "react";
import { Item, ItemDocument, ItemType, Supplier } from "@/types";
import { itemTypeMeta } from "@/lib/item-meta";
import { LocationInput } from "@/components/LocationInput";
import { SupplierCombobox } from "@/components/SupplierCombobox";
import { showUndoToast } from "@/components/UndoToast";
import { RichTextEditor } from "@/components/RichTextEditor";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_ERROR } from "@/lib/constants";

const itemTypes = Object.keys(itemTypeMeta) as ItemType[];

const SUPPLIER_ENABLED_TYPES = new Set<ItemType>(["hotel", "restaurant", "transport"]);

type MetadataFieldDef = {
  name: string;
  label: string;
  type: "text" | "time" | "date" | "select" | "textarea";
  options?: { value: string; label: string }[];
  required?: boolean;
};

const metadataFieldsByType: Record<ItemType, MetadataFieldDef[]> = {
  flight: [
    { name: "airline", required: true, label: "Aerolínea", type: "text" },
    { name: "flightNumber", required: true, label: "Número de vuelo", type: "text" },
    { name: "departureAirport", required: true, label: "Aeropuerto de salida", type: "text" },
    { name: "arrivalAirport", required: true, label: "Aeropuerto de llegada", type: "text" },
    { name: "departureTime", required: true, label: "Hora de salida", type: "time" },
    { name: "arrivalTime", required: true, label: "Hora de llegada", type: "time" },
    { name: "terminal", label: "Terminal", type: "text" },
    { name: "gate", label: "Puerta", type: "text" },
    { name: "seat", label: "Asiento", type: "text" },
    { name: "bookingReference", label: "Referencia de reserva", type: "text" },
  ],
  hotel: [
    { name: "hotelName", required: true, label: "Nombre del hotel", type: "text" },
    { name: "address", required: true, label: "Dirección", type: "text" },
    { name: "checkIn", required: true, label: "Check-in", type: "date" },
    { name: "checkOut", required: true, label: "Check-out", type: "date" },
    { name: "roomType", required: true, label: "Tipo de habitación", type: "text" },
    {
      name: "boardBasis",
      required: true,
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
    { name: "activityName", required: true, label: "Nombre de la actividad", type: "text" },
    { name: "provider", required: true, label: "Proveedor", type: "text" },
    { name: "address", required: true, label: "Dirección", type: "text" },
    { name: "startTime", required: true, label: "Hora de inicio", type: "time" },
    { name: "endTime", required: true, label: "Hora de fin", type: "time" },
    { name: "duration", label: "Duración", type: "text" },
    { name: "ticketType", label: "Tipo de entrada", type: "text" },
    { name: "bookingReference", label: "Referencia de reserva", type: "text" },
    { name: "includes", label: "Incluye", type: "text" },
    { name: "meetingPoint", label: "Punto de encuentro", type: "text" },
  ],
  restaurant: [
    { name: "restaurantName", required: true, label: "Nombre del restaurante", type: "text" },
    { name: "address", required: true, label: "Dirección", type: "text" },
    { name: "cuisine", required: true, label: "Tipo de cocina", type: "text" },
    { name: "dressCode", label: "Código de vestimenta", type: "text" },
    { name: "reservationReference", label: "Referencia de reserva", type: "text" },
    { name: "phone", label: "Teléfono", type: "text" },
  ],
  transport: [
    { name: "company", required: true, label: "Empresa", type: "text" },
    { name: "pickupLocation", required: true, label: "Lugar de recogida", type: "text" },
    { name: "dropoffLocation", required: true, label: "Lugar de destino", type: "text" },
    { name: "pickupTime", required: true, label: "Hora de recogida", type: "text" },
    { name: "vehicleType", label: "Tipo de vehículo", type: "text" },
    { name: "driverName", label: "Nombre del conductor", type: "text" },
    { name: "driverPhone", label: "Teléfono del conductor", type: "text" },
    { name: "bookingReference", label: "Referencia de reserva", type: "text" },
  ],
  note: [],
};

export function appendSerializedMetadata(formData: FormData, selectedType: ItemType) {
  const mFields = metadataFieldsByType[selectedType];
  const rawValues = mFields.map((field) => [field, String(formData.get(`metadata_${field.name}`) ?? "").trim()] as const);
  const requiredValues = rawValues.filter(([field]) => field.required);
  const hasAllRequiredValues = requiredValues.length > 0 && requiredValues.every(([, val]) => val);
  const metadataValues: Record<string, string> = {};
  for (const [field, val] of rawValues) {
    if (val && (field.required || hasAllRequiredValues)) metadataValues[field.name] = val;
    formData.delete(`metadata_${field.name}`);
  }
  formData.set("metadata", JSON.stringify(hasAllRequiredValues ? metadataValues : null));
}

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
  allSuppliers,
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
  allSuppliers?: Supplier[];
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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>(allSuppliers ?? []);
  const [autoFillType, setAutoFillType] = useState<ItemType | null>(null);
  const [selectedType, setSelectedType] = useState<ItemType>(item?.type ?? "activity");
  const [titleValue, setTitleValue] = useState(item?.title ?? "");
  const [locationValue, setLocationValue] = useState(item?.location ?? "");
  const [latValue, setLatValue] = useState<number | undefined>(item?.lat);
  const [lngValue, setLngValue] = useState<number | undefined>(item?.lng);
  const [metadataAutofill, setMetadataAutofill] = useState<Record<string, string>>({});
  const [metadataAutofillVersion, setMetadataAutofillVersion] = useState(0);

  function open() {
    setError(null);
    setUploadError(null);
    setSelectedType(item?.type ?? "activity");
    setAutoFillType(null);
    setSuppliers(allSuppliers ?? []);
    setTitleValue(item?.title ?? "");
    setLocationValue(item?.location ?? "");
    setLatValue(item?.lat);
    setLngValue(item?.lng);
    setMetadataAutofill({});
    setMetadataAutofillVersion((version) => version + 1);
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
    const submittedType = autoFillType ?? selectedType;
    if (autoFillType) formData.set("type", autoFillType);
    if (!formData.get("supplierId") || formData.get("supplierId") === "") {
      formData.delete("supplierId");
    }
    appendSerializedMetadata(formData, submittedType);
    startTransition(async () => {
      try {
        await onSubmit(formData);
        close();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar el item.");
      }
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

  function handleSupplierSelected(supplier: Supplier) {
    if (supplier.type === "hotel" || supplier.type === "restaurant" || supplier.type === "transport") {
      setAutoFillType(supplier.type);
      setSelectedType(supplier.type);
    }

    setTitleValue((current) => (current.trim() ? current : supplier.name));
    if (supplier.address) setLocationValue(supplier.address);
    setLatValue(supplier.lat);
    setLngValue(supplier.lng);

    const nextMetadata: Record<string, string> = {};
    if (supplier.type === "hotel") {
      nextMetadata.hotelName = supplier.name;
      if (supplier.address) nextMetadata.address = supplier.address;
      if (supplier.contactPhone) nextMetadata.hotelPhone = supplier.contactPhone;
    }
    if (supplier.type === "restaurant") {
      nextMetadata.restaurantName = supplier.name;
      if (supplier.address) nextMetadata.address = supplier.address;
      if (supplier.contactPhone) nextMetadata.phone = supplier.contactPhone;
    }
    if (supplier.type === "transport") {
      nextMetadata.company = supplier.name;
      if (supplier.address) nextMetadata.pickupLocation = supplier.address;
      if (supplier.contactPhone) nextMetadata.driverPhone = supplier.contactPhone;
    }
    setMetadataAutofill(nextMetadata);
    setMetadataAutofillVersion((version) => version + 1);
  }

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !onUploadDocument) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(MAX_UPLOAD_ERROR);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploadError(null);
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
              onChange={(e) => {
                setSelectedType(e.target.value as ItemType);
                setAutoFillType(null);
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {itemTypes.map((t) => (
                <option key={t} value={t}>
                  {itemTypeMeta[t].icon} {itemTypeMeta[t].label}
                </option>
              ))}
            </select>
          </div>

          {SUPPLIER_ENABLED_TYPES.has(selectedType) && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Proveedor</label>
              <SupplierCombobox
                suppliers={suppliers}
                name="supplierId"
                defaultValue={item?.supplierId}
                onSupplierSelected={handleSupplierSelected}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Título</label>
            <input
              name="title"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
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
              value={locationValue}
              onValueChange={setLocationValue}
              lat={latValue}
              lng={lngValue}
              onCoordinatesChange={(lat, lng) => {
                setLatValue(lat);
                setLngValue(lng);
              }}
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
            <RichTextEditor name="notes" defaultValue={item?.notes} placeholder="Detalles del item (admite negrita, listas, enlaces…)" />
          </div>

          {selectedType !== "note" && metadataFieldsByType[selectedType].length > 0 && (
            <div key={`${selectedType}-${metadataAutofillVersion}`} className="border-t border-gray-100 pt-4">
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
                        defaultValue={metadataAutofill[field.name] ?? metadataDefaultValue(item, field.name)}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    ) : field.type === "select" && field.options ? (
                      <select
                        name={`metadata_${field.name}`}
                        defaultValue={metadataAutofill[field.name] ?? metadataDefaultValue(item, field.name) ?? ""}
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
                        defaultValue={metadataAutofill[field.name] ?? metadataDefaultValue(item, field.name)}
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
              {uploadError && (
                <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {uploadError}
                </p>
              )}
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
