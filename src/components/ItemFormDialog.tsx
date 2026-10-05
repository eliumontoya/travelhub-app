"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Item, ItemDocument, ItemType, Supplier } from "@/types";
import { showUndoToast } from "@/components/UndoToast";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_ERROR } from "@/lib/constants";
import { shouldAutofillSupplierLocation } from "@/lib/item-location";
import { getSupplierTypeForItem } from "@/lib/item-supplier-compatibility";
import { MetadataFields } from "@/components/item-form/MetadataFields";
import { ItemCommonFields } from "@/components/item-form/ItemCommonFields";
import { ItemDocumentsSection } from "@/components/item-form/ItemDocumentsSection";
import { appendSerializedMetadata } from "@/lib/item-form-fields";

export { appendSerializedMetadata };

type DocWithUrl = ItemDocument & { url: string | null };

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
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocWithUrl[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>(allSuppliers ?? []);
  const [selectedType, setSelectedType] = useState<ItemType>(item?.type ?? "activity");
  const [selectedSupplierId, setSelectedSupplierId] = useState(item?.supplierId ?? "");
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
    setSelectedSupplierId(item?.supplierId ?? "");
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
    const submittedType = selectedType;
    if (!formData.get("supplierId") || formData.get("supplierId") === "") {
      formData.delete("supplierId");
    }
    appendSerializedMetadata(formData, submittedType);
    startTransition(async () => {
      try {
        await onSubmit(formData);
        router.refresh();
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
    setTitleValue((current) => (current.trim() ? current : supplier.name));
    if (shouldAutofillSupplierLocation({ currentLocation: locationValue, currentLat: latValue, currentLng: lngValue })) {
      if (supplier.address) setLocationValue(supplier.address);
      setLatValue(supplier.lat);
      setLngValue(supplier.lng);
    }

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

  function handleItemTypeChange(nextType: ItemType) {
    setSelectedType(nextType);
    setSelectedSupplierId((currentSupplierId) => {
      const supplier = suppliers.find(({ id }) => id === currentSupplierId);
      return supplier && supplier.type === getSupplierTypeForItem(nextType) ? currentSupplierId : "";
    });
  }

  function handleSupplierChange(supplier: Supplier | null) {
    setSelectedSupplierId(supplier?.id ?? "");
    if (supplier) handleSupplierSelected(supplier);
  }

  function handleSupplierCreated(supplier: Supplier) {
    setSuppliers((current) => [supplier, ...current.filter(({ id }) => id !== supplier.id)]);
  }

  const requiredSupplierType = getSupplierTypeForItem(selectedType);

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
        className="w-full max-w-md rounded-xl border border-[var(--operator-border)] p-0 backdrop:bg-black/40"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <h3 className="text-lg font-semibold text-[var(--operator-brand)]">
            {item ? "Editar item" : "Agregar item"}
          </h3>

          <ItemCommonFields
            item={item}
            selectedType={selectedType}
            onTypeChange={handleItemTypeChange}
            suppliers={suppliers}
            selectedSupplierId={selectedSupplierId}
            requiredSupplierType={requiredSupplierType}
            onSupplierChange={handleSupplierChange}
            onSupplierCreated={handleSupplierCreated}
            titleValue={titleValue}
            onTitleChange={setTitleValue}
            locationValue={locationValue}
            onLocationValueChange={setLocationValue}
            latValue={latValue}
            lngValue={lngValue}
            onCoordinatesChange={(lat, lng) => {
              setLatValue(lat);
              setLngValue(lng);
            }}
          />

          <MetadataFields
            type={selectedType}
            item={item}
            metadataAutofill={metadataAutofill}
            autofillVersion={metadataAutofillVersion}
          />

          {item && (
            <ItemDocumentsSection
              docs={docs}
              docsLoading={docsLoading}
              uploadError={uploadError}
              documentsEnabled={documentsEnabled}
              isPending={isPending}
              fileInputRef={fileInputRef}
              onUpload={handleUpload}
              onDeleteDocument={handleDeleteDocument}
            />
          )}

          {error && <p className="text-sm text-[var(--operator-coral)]">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="text-sm text-[var(--operator-coral)] hover:underline"
                >
                  Eliminar
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-[var(--operator-border)] px-4 py-2 text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-[var(--operator-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--operator-brand-strong)] disabled:opacity-50"
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
