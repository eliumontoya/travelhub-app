"use server";

import { Supplier } from "@/types";
import {
  createSupplier,
  updateSupplier,
  softDeleteSupplier,
  restoreSupplier,
} from "@/lib/data";


function parseOptionalCoordinate(value: FormDataEntryValue | null): number | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseSupplierTags(formData: FormData): string[] {
  return String(formData.get("tags") ?? "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag, index, tags) => Boolean(tag) && tags.indexOf(tag) === index);
}

export async function createSupplierAction(
  formData: FormData
): Promise<{ supplier?: Supplier; error?: string }> {
  const name = (formData.get("name") as string)?.trim();
  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const type = (formData.get("type") as string) || "other";

  try {
    const supplier = await createSupplier({
      name,
      type,
      contactPhone: (formData.get("contactPhone") as string)?.trim() || undefined,
      contactEmail: (formData.get("contactEmail") as string)?.trim() || undefined,
      website: (formData.get("website") as string)?.trim() || undefined,
      address: (formData.get("address") as string)?.trim() || undefined,
      lat: parseOptionalCoordinate(formData.get("lat")),
      lng: parseOptionalCoordinate(formData.get("lng")),
      googlePlaceId: (formData.get("googlePlaceId") as string)?.trim() || undefined,
      notes: (formData.get("notes") as string)?.trim() || undefined,
      tags: parseSupplierTags(formData),
    });
    return { supplier };
  } catch {
    return { error: "Error al crear el proveedor." };
  }
}

export async function updateSupplierAction(
  supplierId: string,
  formData: FormData
): Promise<{ supplier?: Supplier; error?: string }> {
  const name = (formData.get("name") as string)?.trim();
  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  try {
    const supplier = await updateSupplier(supplierId, {
      name,
      type: (formData.get("type") as string) || "other",
      contactPhone: (formData.get("contactPhone") as string)?.trim() || undefined,
      contactEmail: (formData.get("contactEmail") as string)?.trim() || undefined,
      website: (formData.get("website") as string)?.trim() || undefined,
      address: (formData.get("address") as string)?.trim() || undefined,
      lat: parseOptionalCoordinate(formData.get("lat")),
      lng: parseOptionalCoordinate(formData.get("lng")),
      googlePlaceId: (formData.get("googlePlaceId") as string)?.trim() || undefined,
      notes: (formData.get("notes") as string)?.trim() || undefined,
      tags: parseSupplierTags(formData),
    });
    return { supplier };
  } catch {
    return { error: "Error al actualizar el proveedor." };
  }
}

export async function softDeleteSupplierAction(
  supplierId: string
): Promise<{ ok: boolean; error?: string; itemCount?: number }> {
  try {
    const result = await softDeleteSupplier(supplierId);
    if (!result.ok) {
      return {
        ok: false,
        error: `Este proveedor está referenciado por ${result.itemCount} item(s). ¿Forzar eliminación?`,
        itemCount: result.itemCount,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Error al eliminar el proveedor." };
  }
}

export async function forceDeleteSupplierAction(
  supplierId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await softDeleteSupplier(supplierId, true);
    return { ok: true };
  } catch {
    return { ok: false, error: "Error al eliminar el proveedor." };
  }
}

export async function restoreSupplierAction(
  supplierId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await restoreSupplier(supplierId);
    return { ok: true };
  } catch {
    return { ok: false, error: "Error al restaurar el proveedor." };
  }
}
