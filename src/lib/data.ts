import { Client, Item, ItemDocument, Trip, TripDay, TripWithDetails } from "@/types";
import {
  mockClients,
  mockTrips,
  mockTripDays,
  mockItems,
  getTripWithDetails as mockGetTripWithDetails,
} from "@/lib/mock-data";
import { createClient as createServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

// Capa de acceso a datos. Si Supabase está configurado (NEXT_PUBLIC_SUPABASE_URL
// presente), todo se lee/escribe de Postgres. Si no, se usan los mocks en
// memoria de mock-data.ts (mutables aquí mismo) para que el dev siga viendo
// la app funcionar sin cuenta de Supabase.

function uid() {
  return crypto.randomUUID();
}

// ---------- Clients ----------

export type CreateClientInput = {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
};

export async function getClients(): Promise<Client[]> {
  if (!isSupabaseConfigured()) return mockClients;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(rowToClient);
}

export async function getClientById(id: string): Promise<Client | null> {
  if (!isSupabaseConfigured()) return mockClients.find((c) => c.id === id) ?? null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToClient(data) : null;
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  if (!isSupabaseConfigured()) {
    const client: Client = {
      id: uid(),
      name: input.name,
      email: input.email ?? "",
      phone: input.phone ?? "",
      notes: input.notes,
      createdAt: new Date().toISOString(),
    };
    mockClients.unshift(client);
    return client;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("clients")
    .insert({ name: input.name, email: input.email, phone: input.phone, notes: input.notes })
    .select()
    .single();
  if (error) throw error;
  return rowToClient(data);
}

function rowToClient(row: Record<string, unknown>): Client {
  return {
    id: row.id as string,
    name: row.name as string,
    email: (row.email as string) ?? "",
    phone: (row.phone as string) ?? "",
    notes: (row.notes as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

// ---------- Trips ----------

export type CreateTripInput = {
  clientId: string;
  title: string;
  slug: string;
  startDate?: string;
  endDate?: string;
  coverImageUrl?: string;
};

export type UpdateTripInput = Partial<{
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  coverImageUrl: string;
  status: Trip["status"];
}>;

export async function getTrips(): Promise<Trip[]> {
  if (!isSupabaseConfigured()) return mockTrips;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(rowToTrip);
}

export async function getTripById(id: string): Promise<TripWithDetails | null> {
  if (!isSupabaseConfigured()) return mockGetTripWithDetails(mockTrips.find((t) => t.id === id)?.slug ?? "");
  const supabase = await createServerSupabase();
  const { data: tripRow, error } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!tripRow) return null;
  return assembleTripWithDetails(tripRow);
}

export async function getTripWithDetails(slug: string): Promise<TripWithDetails | null> {
  if (!isSupabaseConfigured()) return mockGetTripWithDetails(slug);
  const supabase = await createServerSupabase();
  const { data: tripRow, error } = await supabase
    .from("trips")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!tripRow) return null;
  return assembleTripWithDetails(tripRow);
}

async function assembleTripWithDetails(tripRow: Record<string, unknown>): Promise<TripWithDetails> {
  const supabase = await createServerSupabase();
  const trip = rowToTrip(tripRow);

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", trip.clientId)
    .maybeSingle();
  if (clientError) throw clientError;

  const { data: dayRows, error: daysError } = await supabase
    .from("trip_days")
    .select("*")
    .eq("trip_id", trip.id)
    .order("sort_order", { ascending: true });
  if (daysError) throw daysError;

  const dayIds = (dayRows ?? []).map((d) => d.id as string);
  let itemRows: Record<string, unknown>[] = [];
  if (dayIds.length) {
    const { data, error: itemsError } = await supabase
      .from("items")
      .select("*")
      .in("trip_day_id", dayIds)
      .order("sort_order", { ascending: true });
    if (itemsError) throw itemsError;
    itemRows = data ?? [];
  }

  const itemIds = itemRows.map((i) => i.id as string);
  let documentRows: Record<string, unknown>[] = [];
  if (itemIds.length) {
    const { data, error: docsError } = await supabase
      .from("documents")
      .select("*")
      .in("item_id", itemIds);
    if (docsError) throw docsError;
    documentRows = data ?? [];
  }

  const days = (dayRows ?? []).map((d) => {
    const day = rowToTripDay(d);
    const items = itemRows
      .filter((i) => i.trip_day_id === day.id)
      .map((i) => {
        const item = rowToItem(i);
        item.documents = documentRows
          .filter((doc) => doc.item_id === item.id)
          .map(rowToDocument);
        return item;
      });
    return { ...day, items };
  });

  return {
    ...trip,
    client: clientRow ? rowToClient(clientRow) : ({} as Client),
    days,
  };
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
  if (!isSupabaseConfigured()) {
    const trip: Trip = {
      id: uid(),
      clientId: input.clientId,
      title: input.title,
      slug: input.slug,
      startDate: input.startDate ?? "",
      endDate: input.endDate ?? "",
      coverImageUrl: input.coverImageUrl,
      status: "draft",
      createdAt: new Date().toISOString(),
    };
    mockTrips.unshift(trip);
    return trip;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("trips")
    .insert({
      client_id: input.clientId,
      title: input.title,
      slug: input.slug,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      cover_image_url: input.coverImageUrl,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToTrip(data);
}

export async function updateTrip(id: string, input: UpdateTripInput): Promise<Trip> {
  if (!isSupabaseConfigured()) {
    const trip = mockTrips.find((t) => t.id === id);
    if (!trip) throw new Error("Trip no encontrado");
    if (input.title !== undefined) trip.title = input.title;
    if (input.slug !== undefined) trip.slug = input.slug;
    if (input.startDate !== undefined) trip.startDate = input.startDate;
    if (input.endDate !== undefined) trip.endDate = input.endDate;
    if (input.coverImageUrl !== undefined) trip.coverImageUrl = input.coverImageUrl;
    if (input.status !== undefined) trip.status = input.status;
    return trip;
  }
  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.endDate !== undefined) patch.end_date = input.endDate;
  if (input.coverImageUrl !== undefined) patch.cover_image_url = input.coverImageUrl;
  if (input.status !== undefined) patch.status = input.status;
  const { data, error } = await supabase.from("trips").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return rowToTrip(data);
}

function rowToTrip(row: Record<string, unknown>): Trip {
  return {
    id: row.id as string,
    clientId: row.client_id as string,
    title: row.title as string,
    slug: row.slug as string,
    startDate: (row.start_date as string) ?? "",
    endDate: (row.end_date as string) ?? "",
    coverImageUrl: (row.cover_image_url as string) ?? undefined,
    status: row.status as Trip["status"],
    createdAt: row.created_at as string,
  };
}

// ---------- Trip days ----------

export type CreateTripDayInput = { tripId: string; date: string; notes?: string; sortOrder?: number };
export type UpdateTripDayInput = Partial<{ date: string; notes: string; sortOrder: number }>;

export async function createTripDay(input: CreateTripDayInput): Promise<TripDay> {
  if (!isSupabaseConfigured()) {
    const day: TripDay = {
      id: uid(),
      tripId: input.tripId,
      date: input.date,
      notes: input.notes,
      sortOrder:
        input.sortOrder ??
        mockTripDays.filter((d) => d.tripId === input.tripId).length,
    };
    mockTripDays.push(day);
    return day;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("trip_days")
    .insert({
      trip_id: input.tripId,
      date: input.date,
      notes: input.notes,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToTripDay(data);
}

export async function updateTripDay(id: string, input: UpdateTripDayInput): Promise<TripDay> {
  if (!isSupabaseConfigured()) {
    const day = mockTripDays.find((d) => d.id === id);
    if (!day) throw new Error("Día no encontrado");
    if (input.date !== undefined) day.date = input.date;
    if (input.notes !== undefined) day.notes = input.notes;
    if (input.sortOrder !== undefined) day.sortOrder = input.sortOrder;
    return day;
  }
  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = {};
  if (input.date !== undefined) patch.date = input.date;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  const { data, error } = await supabase
    .from("trip_days")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToTripDay(data);
}

export async function deleteTripDay(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const idx = mockTripDays.findIndex((d) => d.id === id);
    if (idx >= 0) mockTripDays.splice(idx, 1);
    for (let i = mockItems.length - 1; i >= 0; i--) {
      if (mockItems[i].tripDayId === id) mockItems.splice(i, 1);
    }
    return;
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("trip_days").delete().eq("id", id);
  if (error) throw error;
}

function rowToTripDay(row: Record<string, unknown>): TripDay {
  return {
    id: row.id as string,
    tripId: row.trip_id as string,
    date: row.date as string,
    notes: (row.notes as string) ?? undefined,
    sortOrder: row.sort_order as number,
  };
}

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
  sortOrder?: number;
};

export type UpdateItemInput = Partial<Omit<CreateItemInput, "tripDayId">>;

export async function createItem(input: CreateItemInput): Promise<Item> {
  if (!isSupabaseConfigured()) {
    const item: Item = {
      id: uid(),
      tripDayId: input.tripDayId,
      type: input.type,
      title: input.title,
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location,
      lat: input.lat,
      lng: input.lng,
      confirmationCode: input.confirmationCode,
      notes: input.notes,
      sortOrder:
        input.sortOrder ?? mockItems.filter((i) => i.tripDayId === input.tripDayId).length,
    };
    mockItems.push(item);
    return item;
  }
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
      notes: input.notes,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToItem(data);
}

export async function updateItem(id: string, input: UpdateItemInput): Promise<Item> {
  if (!isSupabaseConfigured()) {
    const item = mockItems.find((i) => i.id === id);
    if (!item) throw new Error("Item no encontrado");
    Object.assign(item, input);
    return item;
  }
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
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  const { data, error } = await supabase.from("items").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return rowToItem(data);
}

export async function deleteItem(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const idx = mockItems.findIndex((i) => i.id === id);
    if (idx >= 0) mockItems.splice(idx, 1);
    return;
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderItems(order: { id: string; sortOrder: number }[]): Promise<void> {
  if (!isSupabaseConfigured()) {
    for (const { id, sortOrder } of order) {
      const item = mockItems.find((i) => i.id === id);
      if (item) item.sortOrder = sortOrder;
    }
    return;
  }
  const supabase = await createServerSupabase();
  await Promise.all(
    order.map(({ id, sortOrder }) =>
      supabase.from("items").update({ sort_order: sortOrder }).eq("id", id)
    )
  );
}

export async function reorderTripDays(order: { id: string; sortOrder: number }[]): Promise<void> {
  if (!isSupabaseConfigured()) {
    for (const { id, sortOrder } of order) {
      const day = mockTripDays.find((d) => d.id === id);
      if (day) day.sortOrder = sortOrder;
    }
    return;
  }
  const supabase = await createServerSupabase();
  await Promise.all(
    order.map(({ id, sortOrder }) =>
      supabase.from("trip_days").update({ sort_order: sortOrder }).eq("id", id)
    )
  );
}

function rowToItem(row: Record<string, unknown>): Item {
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
    sortOrder: row.sort_order as number,
  };
}

// ---------- Documents ----------

export async function createDocument(input: {
  itemId: string;
  fileUrl: string;
  fileName: string;
}): Promise<ItemDocument> {
  if (!isSupabaseConfigured()) {
    return {
      id: uid(),
      itemId: input.itemId,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      uploadedAt: new Date().toISOString(),
    };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("documents")
    .insert({ item_id: input.itemId, file_url: input.fileUrl, file_name: input.fileName })
    .select()
    .single();
  if (error) throw error;
  return rowToDocument(data);
}

export async function deleteDocument(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}

function rowToDocument(row: Record<string, unknown>): ItemDocument {
  return {
    id: row.id as string,
    itemId: row.item_id as string,
    fileUrl: row.file_url as string,
    fileName: row.file_name as string,
    uploadedAt: row.uploaded_at as string,
  };
}
