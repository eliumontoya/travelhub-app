import { Item } from "@/types";
import { createServerSupabase, sanitizeNote } from "@/lib/data/shared";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSupplierById } from "@/lib/data/suppliers";
import { ItemSupplierCompatibilityError, isSupplierTypeCompatible } from "@/lib/item-supplier-compatibility";

// ---------- Items ----------

export type CreateItemInput = {
  tripDayId: string;
  type: Item["type"];
  title: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  lat?: number;
  lng?: number;
  confirmationCode?: string;
  notes?: string;
  cost?: number;
  sortOrder?: number;
  supplierId?: string;
  metadata?: Record<string, unknown> | null;
};

export type UpdateItemInput = Partial<Omit<CreateItemInput, "tripDayId" | "supplierId">> & {
  supplierId?: string | null;
};

const TRAVELER_ACTIVITY_LIMITS = {
  title: 120,
  location: 200,
  notes: 2_000,
} as const;

const UNAUTHORIZED_TRAVELER_ACTIVITY_RESULT = { ok: false, reason: "unauthorized" } as const;
const INVALID_TRAVELER_ACTIVITY_RESULT = { ok: false, reason: "invalid" } as const;

export type TravelerActivityFields = {
  title: string;
  startTime?: string;
  location?: string;
  notes?: string;
};

export type CreateTravelerActivityInput = TravelerActivityFields & {
  tripId: string;
  tripDayId: string;
  clientId: string;
};

export type UpdateTravelerActivityInput = CreateTravelerActivityInput & {
  itemId: string;
};

export type DeleteTravelerActivityInput = Pick<
  UpdateTravelerActivityInput,
  "tripId" | "tripDayId" | "clientId" | "itemId"
>;

export type TravelerActivityResult =
  | { ok: true; item: Item }
  | typeof UNAUTHORIZED_TRAVELER_ACTIVITY_RESULT
  | typeof INVALID_TRAVELER_ACTIVITY_RESULT;

export type DeleteTravelerActivityResult =
  | { ok: true }
  | typeof UNAUTHORIZED_TRAVELER_ACTIVITY_RESULT;

type NormalizedTravelerActivityFields = {
  title: string;
  startTime: string | null;
  location: string | null;
  notes: string | null;
};

function normalizeTravelerActivityFields(
  input: TravelerActivityFields
): NormalizedTravelerActivityFields | null {
  const title = input.title?.trim();
  const startTime = input.startTime?.trim() || null;
  const location = input.location?.trim() || null;
  const notes = input.notes?.trim() || null;

  if (
    !title ||
    title.length > TRAVELER_ACTIVITY_LIMITS.title ||
    (location !== null && location.length > TRAVELER_ACTIVITY_LIMITS.location) ||
    (notes !== null && notes.length > TRAVELER_ACTIVITY_LIMITS.notes) ||
    (startTime !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime))
  ) {
    return null;
  }

  return {
    title,
    startTime,
    location,
    notes: notes === null ? null : sanitizeNote(notes),
  };
}

export async function canClientAddActivities(tripId: string, clientId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("status", "published")
    .maybeSingle();
  if (tripError || !trip) return false;

  const { data: assignment, error: assignmentError } = await supabase
    .from("trip_clients")
    .select("trip_id")
    .eq("trip_id", tripId)
    .eq("client_id", clientId)
    .maybeSingle();
  return !assignmentError && Boolean(assignment);
}

export async function createTravelerActivity(input: CreateTravelerActivityInput): Promise<TravelerActivityResult> {
  const fields = normalizeTravelerActivityFields(input);
  if (!fields) return INVALID_TRAVELER_ACTIVITY_RESULT;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("create_traveler_activity", {
    p_trip_id: input.tripId,
    p_trip_day_id: input.tripDayId,
    p_client_id: input.clientId,
    p_title: fields.title,
    p_start_time: fields.startTime,
    p_location: fields.location,
    p_notes: fields.notes,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return UNAUTHORIZED_TRAVELER_ACTIVITY_RESULT;
  return { ok: true, item: rowToItem(row) };
}

export async function updateTravelerActivity(input: UpdateTravelerActivityInput): Promise<TravelerActivityResult> {
  const fields = normalizeTravelerActivityFields(input);
  if (!fields) return INVALID_TRAVELER_ACTIVITY_RESULT;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("update_traveler_activity", {
    p_trip_id: input.tripId,
    p_trip_day_id: input.tripDayId,
    p_client_id: input.clientId,
    p_item_id: input.itemId,
    p_title: fields.title,
    p_start_time: fields.startTime,
    p_location: fields.location,
    p_notes: fields.notes,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return UNAUTHORIZED_TRAVELER_ACTIVITY_RESULT;
  return { ok: true, item: rowToItem(row) };
}

export async function deleteTravelerActivity(
  input: DeleteTravelerActivityInput
): Promise<DeleteTravelerActivityResult> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.rpc("soft_delete_traveler_activity", {
    p_trip_id: input.tripId,
    p_trip_day_id: input.tripDayId,
    p_client_id: input.clientId,
    p_item_id: input.itemId,
  });
  return error ? UNAUTHORIZED_TRAVELER_ACTIVITY_RESULT : { ok: true };
}

async function validateItemSupplier(type: Item["type"], supplierId?: string | null): Promise<void> {
  if (supplierId === undefined || supplierId === null) return;

  const supplier = await getSupplierById(supplierId);
  if (!supplier || supplier.deletedAt) {
    throw new ItemSupplierCompatibilityError("El proveedor no existe o no está activo");
  }
  if (!isSupplierTypeCompatible(type, supplier.type)) {
    throw new ItemSupplierCompatibilityError("El proveedor no es compatible con el tipo de item");
  }
}

export async function createItem(input: CreateItemInput): Promise<Item> {
  await validateItemSupplier(input.type, input.supplierId);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("items")
    .insert({
      trip_day_id: input.tripDayId,
      type: input.type,
      title: input.title,
      start_time: input.startTime || null,
      end_time: input.endTime || null,
      location: input.location,
      lat: input.lat,
      lng: input.lng,
      confirmation_code: input.confirmationCode,
      notes: sanitizeNote(input.notes),
      cost: input.cost ?? null,
      supplier_id: input.supplierId || null,
      created_by_client_id: null,
      sort_order: input.sortOrder ?? 0,
      item_metadata: input.metadata ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToItem(data);
}

export async function updateItem(id: string, input: UpdateItemInput): Promise<Item> {
  const current = await getItemById(id);
  if (!current) throw new Error("Item no encontrado");

  const resultingType = input.type ?? current.type;
  const resultingSupplierId = input.supplierId === undefined ? current.supplierId : input.supplierId;
  await validateItemSupplier(resultingType, resultingSupplierId);

  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = {};
  if (input.type !== undefined) patch.type = input.type;
  if (input.title !== undefined) patch.title = input.title;
  if (input.startTime !== undefined) patch.start_time = input.startTime || null;
  if (input.endTime !== undefined) patch.end_time = input.endTime || null;
  if (input.location !== undefined) patch.location = input.location;
  if (input.lat !== undefined) patch.lat = input.lat;
  if (input.lng !== undefined) patch.lng = input.lng;
  if (input.confirmationCode !== undefined) patch.confirmation_code = input.confirmationCode;
  if (input.notes !== undefined) patch.notes = sanitizeNote(input.notes);
  if (input.cost !== undefined) patch.cost = input.cost ?? null;
  if (input.supplierId !== undefined) patch.supplier_id = input.supplierId || null;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.metadata !== undefined) patch.item_metadata = input.metadata ?? null;
  const { data, error } = await supabase.from("items").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return rowToItem(data);
}

// Soft delete (issue #23): ver comentario de deleteTripDay.
export async function deleteItem(id: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function restoreItem(id: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("items").update({ deleted_at: null }).eq("id", id);
  if (error) throw error;
}

// Reasigna un item a otro día del mismo viaje (issue #132) sin borrarlo.
// Lo coloca al final del día destino (sort_order = max + 1) para no romper
// el orden relativo de los items ya existentes en ese día.
export async function moveItemToDay(itemId: string, targetDayId: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { data: siblings, error: siblingsError } = await supabase
    .from("items")
    .select("sort_order")
    .eq("trip_day_id", targetDayId)
    .is("deleted_at", null);
  if (siblingsError) throw siblingsError;
  const maxSort = (siblings ?? []).reduce(
    (max, row) => Math.max(max, (row.sort_order as number) ?? 0),
    -1
  );
  const { error } = await supabase
    .from("items")
    .update({ trip_day_id: targetDayId, sort_order: maxSort + 1 })
    .eq("id", itemId);
  if (error) throw error;
}

export async function getItemById(id: string): Promise<Item | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("items")
    .select(
      "id, trip_day_id, type, title, start_time, end_time, location, lat, lng, confirmation_code, notes, cost, supplier_id, created_by_client_id, sort_order, item_metadata, deleted_at"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToItem(data) : null;
}

async function getNextItemSortOrder(tripDayId: string): Promise<number> {
  const supabase = await createServerSupabase();
  const { count, error } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("trip_day_id", tripDayId)
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function duplicateItem(
  sourceItemId: string,
  targetDayId: string
): Promise<Item> {
  const source = await getItemById(sourceItemId);
  if (!source) throw new Error("Item no encontrado");
  const sortOrder = await getNextItemSortOrder(targetDayId);
  return createItem({
    tripDayId: targetDayId,
    type: source.type,
    title: source.title,
    startTime: source.startTime,
    endTime: source.endTime,
    location: source.location,
    lat: source.lat,
    lng: source.lng,
    confirmationCode: source.confirmationCode,
    notes: source.notes,
    cost: source.cost,
    supplierId: source.supplierId,
    metadata: (source.metadata as unknown as Record<string, unknown> | null) ?? null,
    sortOrder,
  });
}

export async function reorderItems(order: { id: string; sortOrder: number }[]): Promise<void> {
  const supabase = await createServerSupabase();
  await Promise.all(
    order.map(({ id, sortOrder }) =>
      supabase.from("items").update({ sort_order: sortOrder }).eq("id", id)
    )
  );
}

export function rowToItem(row: Record<string, unknown>): Item {
  const rawMetadata = row.item_metadata;
  const metadata: Item["metadata"] =
    rawMetadata && typeof rawMetadata === "string"
      ? (JSON.parse(rawMetadata) as unknown as Item["metadata"])
      : rawMetadata && typeof rawMetadata === "object"
        ? (rawMetadata as unknown as Item["metadata"])
        : null;
  return {
    id: row.id as string,
    tripDayId: row.trip_day_id as string,
    type: row.type as Item["type"],
    title: row.title as string,
    startTime: (row.start_time as string) ?? undefined,
    endTime: (row.end_time as string) ?? undefined,
    location: (row.location as string) ?? undefined,
    lat: row.lat !== null && row.lat !== undefined ? Number(row.lat) : undefined,
    lng: row.lng !== null && row.lng !== undefined ? Number(row.lng) : undefined,
    confirmationCode: (row.confirmation_code as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    cost: row.cost !== null && row.cost !== undefined ? Number(row.cost) : undefined,
    supplierId: (row.supplier_id as string) ?? undefined,
    createdByClientId: (row.created_by_client_id as string | null) ?? null,
    sortOrder: row.sort_order as number,
    metadata,
  } as Item;
}
