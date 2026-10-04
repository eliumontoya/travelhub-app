import type { SupplierType } from "@/lib/constants";
import type { ItemType } from "@/types";

export const ITEM_SUPPLIER_TYPE = {
  hotel: "hotel",
  activity: "tour_operator",
  restaurant: "restaurant",
  transport: "transport",
} as const satisfies Partial<Record<ItemType, SupplierType>>;

type SupplierEnabledItemType = keyof typeof ITEM_SUPPLIER_TYPE;

export function getSupplierTypeForItem(type: ItemType): SupplierType | null {
  return ITEM_SUPPLIER_TYPE[type as SupplierEnabledItemType] ?? null;
}

export function isSupplierTypeCompatible(type: ItemType, supplierType: string): boolean {
  return getSupplierTypeForItem(type) === supplierType;
}

export class ItemSupplierCompatibilityError extends Error {
  readonly code = "ITEM_SUPPLIER_INCOMPATIBLE";

  constructor(message: string) {
    super(message);
    this.name = "ItemSupplierCompatibilityError";
  }
}

export function isItemSupplierCompatibilityError(error: unknown): error is ItemSupplierCompatibilityError {
  return error instanceof ItemSupplierCompatibilityError;
}
