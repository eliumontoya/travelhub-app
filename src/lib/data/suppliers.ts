import { Supplier } from "@/types";
import { mockItems, mockSuppliers } from "@/lib/mock-data";
import { PaginatedResult, createServerSupabase, isSupabaseConfigured, paginationBounds, sanitizeNote, uid } from "@/lib/data/shared";

// ---------- Suppliers ----------

// Para cargar el catálogo completo en el combobox de selección de proveedor.
export const ALL_SUPPLIERS_PAGE_SIZE = 1000;

export type CreateSupplierInput = {
  name: string;
  type: string;
  contactPhone?: string;
  contactEmail?: string;
  website?: string;
  address?: string;
  lat?: number;
  lng?: number;
  notes?: string;
  tags?: string[];
  googlePlaceId?: string;
};

export type SupplierFilterParams = {
  page?: number;
  pageSize?: number;
  query?: string;
  type?: string;
  tag?: string;
};

export async function getSuppliers(
  params: SupplierFilterParams = {}
): Promise<PaginatedResult<Supplier>> {
  const { from, pageSize } = paginationBounds(params);

  if (!isSupabaseConfigured()) {
    let filtered = [...mockSuppliers];
    if (params.query) {
      const q = params.query.toLowerCase();
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(q));
    }
    if (params.type) {
      filtered = filtered.filter((s) => s.type === params.type);
    }
    if (params.tag) {
      const tag = params.tag.toLowerCase();
      filtered = filtered.filter((s) => s.tags.some((t) => t.toLowerCase().includes(tag)));
    }
    const active = filtered.filter((s) => !s.deletedAt);
    return { items: active.slice(from, from + pageSize), totalCount: active.length };
  }

  const supabase = await createServerSupabase();
  let query = supabase
    .from("suppliers")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (params.query) {
    query = query.ilike("name", `%${params.query}%`);
  }
  if (params.type) {
    query = query.eq("type", params.type);
  }
  if (params.tag) {
    query = query.contains("tags", [params.tag]);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { items: (data ?? []).map(rowToSupplier), totalCount: count ?? 0 };
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  if (!isSupabaseConfigured()) {
    return mockSuppliers.find((s) => s.id === id) ?? null;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToSupplier(data) : null;
}

export async function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  if (!isSupabaseConfigured()) {
    const now = new Date().toISOString();
    const supplier: Supplier = {
      id: uid(),
      name: input.name,
      type: input.type,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
      website: input.website,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
      googlePlaceId: input.googlePlaceId,
      notes: sanitizeNote(input.notes),
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    mockSuppliers.unshift(supplier);
    return supplier;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      name: input.name,
      type: input.type,
      contact_phone: input.contactPhone || null,
      contact_email: input.contactEmail || null,
      website: input.website || null,
      address: input.address || null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      google_place_id: input.googlePlaceId || null,
      notes: sanitizeNote(input.notes) || null,
      tags: input.tags ?? [],
    })
    .select()
    .single();
  if (error) throw error;
  return rowToSupplier(data);
}

export async function updateSupplier(
  id: string,
  input: Partial<CreateSupplierInput>
): Promise<Supplier> {
  if (!isSupabaseConfigured()) {
    const supplier = mockSuppliers.find((s) => s.id === id);
    if (!supplier) throw new Error("Proveedor no encontrado");
    if (input.name !== undefined) supplier.name = input.name;
    if (input.type !== undefined) supplier.type = input.type;
    if (input.contactPhone !== undefined) supplier.contactPhone = input.contactPhone;
    if (input.contactEmail !== undefined) supplier.contactEmail = input.contactEmail;
    if (input.website !== undefined) supplier.website = input.website;
    if (input.address !== undefined) supplier.address = input.address;
    if (input.lat !== undefined) supplier.lat = input.lat;
    if (input.lng !== undefined) supplier.lng = input.lng;
    if (input.googlePlaceId !== undefined) supplier.googlePlaceId = input.googlePlaceId;
    if (input.notes !== undefined) supplier.notes = sanitizeNote(input.notes);
    if (input.tags !== undefined) supplier.tags = input.tags;
    supplier.updatedAt = new Date().toISOString();
    return supplier;
  }
  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.type !== undefined) patch.type = input.type;
  if (input.contactPhone !== undefined) patch.contact_phone = input.contactPhone || null;
  if (input.contactEmail !== undefined) patch.contact_email = input.contactEmail || null;
  if (input.website !== undefined) patch.website = input.website || null;
  if (input.address !== undefined) patch.address = input.address || null;
  if (input.lat !== undefined) patch.lat = input.lat ?? null;
  if (input.lng !== undefined) patch.lng = input.lng ?? null;
  if (input.googlePlaceId !== undefined) patch.google_place_id = input.googlePlaceId || null;
  if (input.notes !== undefined) patch.notes = input.notes || null;
  if (input.tags !== undefined) patch.tags = input.tags;
  patch.updated_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("suppliers")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToSupplier(data);
}

export async function getSupplierItemCount(id: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    return mockItems.filter((i) => i.supplierId === id && !i.deletedAt).length;
  }
  const supabase = await createServerSupabase();
  const { count, error } = await supabase
    .from("items")
    .select("*", { count: "exact", head: true })
    .eq("supplier_id", id)
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function softDeleteSupplier(
  id: string,
  force?: boolean
): Promise<{ ok: boolean; itemCount?: number }> {
  const itemCount = await getSupplierItemCount(id);
  if (itemCount > 0 && !force) {
    return { ok: false, itemCount };
  }

  if (!isSupabaseConfigured()) {
    const supplier = mockSuppliers.find((s) => s.id === id);
    if (supplier) supplier.deletedAt = new Date().toISOString();
    return { ok: true };
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("suppliers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function restoreSupplier(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const supplier = mockSuppliers.find((s) => s.id === id);
    if (supplier) supplier.deletedAt = undefined;
    return;
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("suppliers")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) throw error;
}

export function rowToSupplier(row: Record<string, unknown>): Supplier {
  return {
    id: row.id as string,
    name: row.name as string,
    type: (row.type as string) ?? "other",
    contactPhone: (row.contact_phone as string) ?? undefined,
    contactEmail: (row.contact_email as string) ?? undefined,
    website: (row.website as string) ?? undefined,
    address: (row.address as string) ?? undefined,
    lat: row.lat !== null && row.lat !== undefined ? Number(row.lat) : undefined,
    lng: row.lng !== null && row.lng !== undefined ? Number(row.lng) : undefined,
    googlePlaceId: (row.google_place_id as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    deletedAt: (row.deleted_at as string) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? (row.created_at as string),
  };
}
