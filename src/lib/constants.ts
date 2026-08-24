export const SUPPLIER_TYPES = ["hotel", "tour_operator", "transport", "restaurant", "other"] as const;
export type SupplierType = (typeof SUPPLIER_TYPES)[number];

// Límite de tamaño de subida. Debe coincidir con el bodySizeLimit de los
// Server Actions en next.config.ts (experimental.serverActions.bodySizeLimit).
export const MAX_UPLOAD_MB = 20;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const MAX_UPLOAD_ERROR = `El archivo no puede superar los ${MAX_UPLOAD_MB} MB.`;

// Convierte un nombre de archivo en una key válida para Supabase Storage.
// Supabase rechaza keys con espacios o caracteres no-ASCII (acentos), así que
// se normalizan (ó -> o, espacios -> "-") conservando la extensión.
export function sanitizeStorageKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}
