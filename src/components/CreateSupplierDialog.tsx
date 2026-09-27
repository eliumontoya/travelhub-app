"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Supplier } from "@/types";
import { SUPPLIER_TYPES } from "@/lib/constants";
import { RichTextEditor } from "@/components/RichTextEditor";
import { SupplierPlaceAutocomplete, SupplierPlaceSelection } from "@/components/SupplierPlaceAutocomplete";
import {
  createSupplierAction,
  updateSupplierAction,
} from "@/app/dashboard/suppliers/actions";

export function CreateSupplierDialog({
  open,
  onClose,
  onCreated,
  onUpdated,
  supplier,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (supplier: Supplier) => void;
  onUpdated?: () => void;
  supplier?: Supplier;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(supplier?.name ?? "");
  const [address, setAddress] = useState(supplier?.address ?? "");
  const [lat, setLat] = useState(supplier?.lat?.toString() ?? "");
  const [lng, setLng] = useState(supplier?.lng?.toString() ?? "");
  const [googlePlaceId, setGooglePlaceId] = useState(supplier?.googlePlaceId ?? "");

  const isEditing = Boolean(supplier);

  useEffect(() => {
    if (open && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, [open]);

  const handlePlaceSelect = useCallback((place: SupplierPlaceSelection) => {
    if (place.name) setName(place.name);
    if (place.address) setAddress(place.address);
    if (place.lat !== undefined) setLat(String(place.lat));
    if (place.lng !== undefined) setLng(String(place.lng));
    setGooglePlaceId(place.googlePlaceId);
  }, []);

  function close() {
    dialogRef.current?.close();
    onClose();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      if (isEditing && supplier) {
        const result = await updateSupplierAction(supplier.id, formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        onUpdated?.();
        close();
      } else {
        const result = await createSupplierAction(formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.supplier) {
          onCreated?.(result.supplier);
          close();
        }
      }
    });
  }

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-md rounded-xl border border-[var(--operator-border)] p-0 backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <h3 className="text-lg font-semibold text-[var(--operator-brand)]">
          {isEditing ? "Editar proveedor" : "Crear proveedor"}
        </h3>

        <div>
          <label htmlFor="supplier-name" className="block text-sm font-medium text-[var(--operator-ink)]">
            Nombre *
          </label>
          <input
            id="supplier-name"
            name="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
            placeholder="Nombre del proveedor"
          />
        </div>

        <div>
          <label htmlFor="supplier-type" className="block text-sm font-medium text-[var(--operator-ink)]">
            Tipo
          </label>
          <select
            id="supplier-type"
            name="type"
            defaultValue={supplier?.type ?? "hotel"}
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          >
            {SUPPLIER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <SupplierPlaceAutocomplete onPlaceSelect={handlePlaceSelect} />

        <div>
          <label htmlFor="supplier-phone" className="block text-sm font-medium text-[var(--operator-ink)]">
            Teléfono
          </label>
          <input
            id="supplier-phone"
            name="contactPhone"
            type="tel"
            defaultValue={supplier?.contactPhone}
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
            placeholder="+54 11 1234-5678"
          />
        </div>

        <div>
          <label htmlFor="supplier-email" className="block text-sm font-medium text-[var(--operator-ink)]">
            Email
          </label>
          <input
            id="supplier-email"
            name="contactEmail"
            type="email"
            defaultValue={supplier?.contactEmail}
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
            placeholder="email@ejemplo.com"
          />
        </div>

        <div>
          <label htmlFor="supplier-website" className="block text-sm font-medium text-[var(--operator-ink)]">
            Sitio web
          </label>
          <input
            id="supplier-website"
            name="website"
            type="url"
            defaultValue={supplier?.website}
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
            placeholder="https://ejemplo.com"
          />
        </div>

        <div>
          <label htmlFor="supplier-address" className="block text-sm font-medium text-[var(--operator-ink)]">
            Dirección
          </label>
          <input
            id="supplier-address"
            name="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
            placeholder="Calle y número, Ciudad"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="supplier-lat" className="block text-sm font-medium text-[var(--operator-ink)]">
              Latitud
            </label>
            <input
              id="supplier-lat"
              name="lat"
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
              placeholder="19.432608"
            />
          </div>
          <div>
            <label htmlFor="supplier-lng" className="block text-sm font-medium text-[var(--operator-ink)]">
              Longitud
            </label>
            <input
              id="supplier-lng"
              name="lng"
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
              placeholder="-99.133209"
            />
          </div>
        </div>
        <input type="hidden" name="googlePlaceId" value={googlePlaceId} readOnly />
        {googlePlaceId && (
          <p className="text-xs text-[var(--operator-ink-muted)]">Google Place ID capturado para futuras actualizaciones.</p>
        )}

        <div>
          <label htmlFor="supplier-tags" className="block text-sm font-medium text-[var(--operator-ink)]">
            Tags
          </label>
          <input
            id="supplier-tags"
            name="tags"
            type="text"
            defaultValue={supplier?.tags.join(", ")}
            className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
            placeholder="playa, 5 estrellas, familiar"
          />
          <p className="mt-1 text-xs text-[var(--operator-ink-muted)]">Separados por coma.</p>
        </div>

        <div>
          <label htmlFor="supplier-notes" className="block text-sm font-medium text-[var(--operator-ink)]">
            Notas
          </label>
          <RichTextEditor
            name="notes"
            defaultValue={supplier?.notes}
            placeholder="Notas del proveedor (admite negrita, listas, enlaces…)"
          />
        </div>

        {error && <p className="text-sm text-[var(--operator-coral)]">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
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
            {isPending ? "Guardando…" : isEditing ? "Guardar" : "Crear"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
