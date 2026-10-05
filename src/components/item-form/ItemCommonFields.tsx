"use client";

import { Item, ItemType, Supplier } from "@/types";
import type { SupplierType } from "@/lib/constants";
import { itemTypeMeta } from "@/lib/item-meta";
import { LocationInput } from "@/components/LocationInput";
import { SupplierCombobox } from "@/components/SupplierCombobox";
import { RichTextEditor } from "@/components/RichTextEditor";

const itemTypes = Object.keys(itemTypeMeta) as ItemType[];

export function ItemCommonFields({
  item,
  selectedType,
  onTypeChange,
  suppliers,
  selectedSupplierId,
  requiredSupplierType,
  onSupplierChange,
  onSupplierCreated,
  titleValue,
  onTitleChange,
  locationValue,
  onLocationValueChange,
  latValue,
  lngValue,
  onCoordinatesChange,
}: {
  item?: Item;
  selectedType: ItemType;
  onTypeChange: (type: ItemType) => void;
  suppliers: Supplier[];
  selectedSupplierId: string;
  requiredSupplierType?: SupplierType | null;
  onSupplierChange: (supplier: Supplier | null) => void;
  onSupplierCreated: (supplier: Supplier) => void;
  titleValue: string;
  onTitleChange: (value: string) => void;
  locationValue: string;
  onLocationValueChange: (value: string) => void;
  latValue?: number;
  lngValue?: number;
  onCoordinatesChange: (lat?: number, lng?: number) => void;
}) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-[var(--operator-ink)]">Tipo</label>
        <select
          name="type"
          value={selectedType}
          onChange={(e) => onTypeChange(e.target.value as ItemType)}
          className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
        >
          {itemTypes.map((t) => (
            <option key={t} value={t}>
              {itemTypeMeta[t].label}
            </option>
          ))}
        </select>
      </div>

      {requiredSupplierType && (
        <div>
          <label className="block text-sm font-medium text-[var(--operator-ink)]">Proveedor</label>
          <SupplierCombobox
            key={requiredSupplierType}
            suppliers={suppliers}
            name="supplierId"
            requiredSupplierType={requiredSupplierType}
            value={selectedSupplierId}
            onChange={onSupplierChange}
            onSupplierCreated={onSupplierCreated}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[var(--operator-ink)]">Título</label>
        <input
          name="title"
          value={titleValue}
          onChange={(e) => onTitleChange(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[var(--operator-ink)]">Hora inicio</label>
          <input
            type="time"
            name="startTime"
            defaultValue={item?.startTime}
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--operator-ink)]">Hora fin</label>
          <input
            type="time"
            name="endTime"
            defaultValue={item?.endTime}
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--operator-ink)]">Ubicación</label>
        <LocationInput
          defaultValue={item?.location}
          defaultLat={item?.lat}
          defaultLng={item?.lng}
          value={locationValue}
          onValueChange={onLocationValueChange}
          lat={latValue}
          lng={lngValue}
          onCoordinatesChange={onCoordinatesChange}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[var(--operator-ink)]">
            Código de confirmación
          </label>
          <input
            name="confirmationCode"
            defaultValue={item?.confirmationCode}
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--operator-ink)]">Costo</label>
          <input
            type="number"
            step="0.01"
            min="0"
            name="cost"
            defaultValue={item?.cost}
            placeholder="Solo visible internamente salvo que actives el resumen de costos"
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--operator-ink)]">Notas</label>
        <RichTextEditor name="notes" defaultValue={item?.notes} placeholder="Detalles del item (admite negrita, listas, enlaces…)" />
      </div>
    </>
  );
}
