export const SUPPLIER_TYPES = ["hotel", "tour_operator", "transport", "restaurant", "other"] as const;
export type SupplierType = (typeof SUPPLIER_TYPES)[number];
