"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Supplier } from "@/types";
import { SUPPLIER_TYPES } from "@/lib/constants";
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

  const isEditing = Boolean(supplier);

  useEffect(() => {
    if (open && dialogRef.current && !dialogRef.current.open) {
      setError(null);
      dialogRef.current.showModal();
    }
  }, [open]);

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
      className="w-full max-w-md rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <h3 className="text-lg font-semibold text-gray-900">
          {isEditing ? "Editar proveedor" : "Crear proveedor"}
        </h3>

        <div>
          <label htmlFor="supplier-name" className="block text-sm font-medium text-gray-700">
            Nombre *
          </label>
          <input
            id="supplier-name"
            name="name"
            type="text"
            required
            defaultValue={supplier?.name}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Nombre del proveedor"
          />
        </div>

        <div>
          <label htmlFor="supplier-type" className="block text-sm font-medium text-gray-700">
            Tipo
          </label>
          <select
            id="supplier-type"
            name="type"
            defaultValue={supplier?.type ?? "hotel"}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {SUPPLIER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="supplier-phone" className="block text-sm font-medium text-gray-700">
            Teléfono
          </label>
          <input
            id="supplier-phone"
            name="contactPhone"
            type="tel"
            defaultValue={supplier?.contactPhone}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="+54 11 1234-5678"
          />
        </div>

        <div>
          <label htmlFor="supplier-email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="supplier-email"
            name="contactEmail"
            type="email"
            defaultValue={supplier?.contactEmail}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="email@ejemplo.com"
          />
        </div>

        <div>
          <label htmlFor="supplier-website" className="block text-sm font-medium text-gray-700">
            Sitio web
          </label>
          <input
            id="supplier-website"
            name="website"
            type="url"
            defaultValue={supplier?.website}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="https://ejemplo.com"
          />
        </div>

        <div>
          <label htmlFor="supplier-address" className="block text-sm font-medium text-gray-700">
            Dirección
          </label>
          <input
            id="supplier-address"
            name="address"
            type="text"
            defaultValue={supplier?.address}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Calle y número, Ciudad"
          />
        </div>

        <div>
          <label htmlFor="supplier-notes" className="block text-sm font-medium text-gray-700">
            Notas
          </label>
          <textarea
            id="supplier-notes"
            name="notes"
            rows={2}
            defaultValue={supplier?.notes}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
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
            {isPending ? "Guardando…" : isEditing ? "Guardar" : "Crear"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
