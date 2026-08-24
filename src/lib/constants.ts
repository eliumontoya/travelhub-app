export const SUPPLIER_TYPES = ["hotel", "tour_operator", "transport", "restaurant", "other"] as const;
export type SupplierType = (typeof SUPPLIER_TYPES)[number];

// Límite de tamaño de subida. Debe coincidir con el bodySizeLimit de los
// Server Actions en next.config.ts (experimental.serverActions.bodySizeLimit).
export const MAX_UPLOAD_MB = 20;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const MAX_UPLOAD_ERROR = `El archivo no puede superar los ${MAX_UPLOAD_MB} MB.`;
