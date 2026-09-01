import { sanitizeNote } from "@/lib/sanitize";
import { createClient as createServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { slugify } from "@/lib/slugify";
import { sanitizeStorageKey } from "@/lib/constants";
import { hasActiveTripFilters, tripMatchesFilters } from "@/lib/trip-filters";

export { sanitizeNote, createServerSupabase, isSupabaseConfigured, slugify, sanitizeStorageKey, hasActiveTripFilters, tripMatchesFilters };

export function uid() {
  return crypto.randomUUID();
}

export function effectiveWhatsapp(whatsapp?: string, phone?: string) {
  return whatsapp?.trim() || phone?.trim() || "";
}

export const DEFAULT_PAGE_SIZE = 20;
export const ALL_CLIENTS_PAGE_SIZE = 1000;
export const ALL_TRIPS_PAGE_SIZE = 1000;

export type PaginationParams = { page?: number; pageSize?: number };
export type PaginatedResult<T> = { items: T[]; totalCount: number };

export function paginationBounds(params: PaginationParams) {
  const page = params.page && params.page > 0 ? params.page : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}
