import { Client, Item, ItemDocument, SiteSettings, Tag, Trip, TripDay, TripWithDetails } from "@/types";
import {
  mockClients,
  mockTrips,
  mockTripDays,
  mockItems,
  mockSiteSettings,
  mockTripClients,
  mockTags,
  mockTripTags,
  mockClientTags,
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

export async function getClientByEmail(email: string): Promise<Client | null> {
  if (!isSupabaseConfigured()) {
    return mockClients.find((c) => c.email.toLowerCase() === email.toLowerCase()) ?? null;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("email", email)
    .maybeSingle();
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

export async function updateClient(id: string, input: Partial<CreateClientInput>): Promise<Client> {
  if (!isSupabaseConfigured()) {
    const client = mockClients.find((c) => c.id === id);
    if (!client) throw new Error("Cliente no encontrado");
    if (input.name !== undefined) client.name = input.name;
    if (input.email !== undefined) client.email = input.email;
    if (input.phone !== undefined) client.phone = input.phone;
    if (input.notes !== undefined) client.notes = input.notes;
    return client;
  }
  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.email !== undefined) patch.email = input.email;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.notes !== undefined) patch.notes = input.notes;
  const { data, error } = await supabase.from("clients").update(patch).eq("id", id).select().single();
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

// Query batcheada para el dashboard/list: clients + UN solo client_tags.in()
// + UN solo tags.in() (sin N+1 por fila), mismo patrón que getTripsWithClients.
export async function getClientsWithTags(): Promise<(Client & { tags: Tag[] })[]> {
  if (!isSupabaseConfigured()) {
    return mockClients.map((client) => ({
      ...client,
      tags: mockClientTags
        .filter((ct) => ct.clientId === client.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((ct) => mockTags.find((t) => t.id === ct.tagId))
        .filter((t): t is Tag => Boolean(t)),
    }));
  }

  const supabase = await createServerSupabase();
  const { data: clientRows, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const clients = (clientRows ?? []).map(rowToClient);
  const clientIds = clients.map((c) => c.id);
  if (!clientIds.length) return [];

  const { data: tagLinkRows, error: tagLinksError } = await supabase
    .from("client_tags")
    .select("client_id, tag_id, created_at")
    .in("client_id", clientIds)
    .order("created_at", { ascending: true });
  if (tagLinksError) throw tagLinksError;

  const tagIds = [...new Set((tagLinkRows ?? []).map((l) => l.tag_id as string))];
  let tagsById = new Map<string, Tag>();
  if (tagIds.length) {
    const { data: tagRows, error: tagsError } = await supabase
      .from("tags")
      .select("*")
      .in("id", tagIds);
    if (tagsError) throw tagsError;
    tagsById = new Map((tagRows ?? []).map((t) => [t.id as string, rowToTag(t)]));
  }

  return clients.map((client) => ({
    ...client,
    tags: (tagLinkRows ?? [])
      .filter((l) => l.client_id === client.id)
      .map((l) => tagsById.get(l.tag_id as string))
      .filter((t): t is Tag => Boolean(t)),
  }));
}

// Tags asignados a un solo cliente (0..N), ordenados por created_at asc.
export async function getClientTags(clientId: string): Promise<Tag[]> {
  if (!isSupabaseConfigured()) {
    return mockClientTags
      .filter((ct) => ct.clientId === clientId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((ct) => mockTags.find((t) => t.id === ct.tagId))
      .filter((t): t is Tag => Boolean(t));
  }
  const supabase = await createServerSupabase();
  const { data: tagLinkRows, error: tagLinksError } = await supabase
    .from("client_tags")
    .select("tag_id, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  if (tagLinksError) throw tagLinksError;

  const orderedTagIds = (tagLinkRows ?? []).map((l) => l.tag_id as string);
  if (!orderedTagIds.length) return [];
  const { data: tagRows, error: tagsError } = await supabase
    .from("tags")
    .select("*")
    .in("id", orderedTagIds);
  if (tagsError) throw tagsError;
  const tagById = new Map((tagRows ?? []).map((t) => [t.id as string, rowToTag(t)]));
  return orderedTagIds.map((id) => tagById.get(id)).filter((t): t is Tag => Boolean(t));
}

// Reemplaza el conjunto completo de tags asignados a un cliente mediante un
// diff (borra los removidos + inserta los agregados), mismo patrón que
// setTripTags. 0 tags es válido, no lanza.
export async function setClientTags(clientId: string, tagIds: string[]): Promise<void> {
  if (!isSupabaseConfigured()) {
    const current = mockClientTags.filter((ct) => ct.clientId === clientId);
    const currentIds = new Set(current.map((ct) => ct.tagId));
    const nextIds = new Set(tagIds);

    for (let i = mockClientTags.length - 1; i >= 0; i--) {
      const ct = mockClientTags[i];
      if (ct.clientId === clientId && !nextIds.has(ct.tagId)) {
        mockClientTags.splice(i, 1);
      }
    }
    const now = Date.now();
    tagIds.forEach((tagId, idx) => {
      if (!currentIds.has(tagId)) {
        mockClientTags.push({ clientId, tagId, createdAt: new Date(now + idx).toISOString() });
      }
    });
    return;
  }

  const supabase = await createServerSupabase();
  const { data: currentRows, error: currentError } = await supabase
    .from("client_tags")
    .select("tag_id")
    .eq("client_id", clientId);
  if (currentError) throw currentError;

  const currentIds = new Set((currentRows ?? []).map((r) => r.tag_id as string));
  const nextIds = new Set(tagIds);
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));
  const toAdd = tagIds.filter((id) => !currentIds.has(id));

  if (toRemove.length) {
    const { error: removeError } = await supabase
      .from("client_tags")
      .delete()
      .eq("client_id", clientId)
      .in("tag_id", toRemove);
    if (removeError) throw removeError;
  }

  if (toAdd.length) {
    const { error: addError } = await supabase
      .from("client_tags")
      .upsert(
        toAdd.map((tagId) => ({ client_id: clientId, tag_id: tagId })),
        { onConflict: "client_id,tag_id", ignoreDuplicates: true }
      );
    if (addError) throw addError;
  }
}

// ---------- Tags ----------

function rowToTag(row: Record<string, unknown>): Tag {
  return {
    id: row.id as string,
    name: row.name as string,
    createdAt: row.created_at as string,
  };
}

export async function getTags(): Promise<Tag[]> {
  if (!isSupabaseConfigured()) {
    return [...mockTags].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("tags")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(rowToTag);
}

// Busca un tag por nombre case-insensitive; si no existe, lo crea. Nunca
// crea una segunda fila de catálogo para un nombre que difiera solo en
// mayúsculas/minúsculas (spec §4). Trimea el nombre y rechaza vacío.
export async function getOrCreateTag(name: string): Promise<Tag> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre del tag no puede estar vacío");
  const normalized = trimmed.toLowerCase();

  if (!isSupabaseConfigured()) {
    const existing = mockTags.find((t) => t.name.toLowerCase() === normalized);
    if (existing) return existing;
    const tag: Tag = { id: uid(), name: trimmed, createdAt: new Date().toISOString() };
    mockTags.push(tag);
    return tag;
  }

  const supabase = await createServerSupabase();

  // ilike es case-insensitive pero trata % y _ como wildcards; se guarda con
  // una comparación exacta en JS después de normalizar a minúsculas.
  const { data: candidates, error: findError } = await supabase
    .from("tags")
    .select("*")
    .ilike("name", trimmed);
  if (findError) throw findError;
  const existingRow = (candidates ?? []).find(
    (row) => (row.name as string).toLowerCase() === normalized
  );
  if (existingRow) return rowToTag(existingRow);

  const { data: inserted, error: insertError } = await supabase
    .from("tags")
    .insert({ name: trimmed })
    .select()
    .single();
  if (!insertError) return rowToTag(inserted);

  // 23505 = unique_violation (índice lower(name)): otra llamada concurrente
  // ganó la carrera. Re-seleccionar y devolver la fila ganadora.
  if ((insertError as { code?: string }).code === "23505") {
    const { data: winner, error: reselectError } = await supabase
      .from("tags")
      .select("*")
      .ilike("name", trimmed);
    if (reselectError) throw reselectError;
    const winnerRow = (winner ?? []).find(
      (row) => (row.name as string).toLowerCase() === normalized
    );
    if (winnerRow) return rowToTag(winnerRow);
  }
  throw insertError;
}

// Reemplaza el conjunto completo de tags asignados a un viaje mediante un
// diff (borra los removidos + inserta los agregados), NO delete-all-then-
// reinsert, para preservar el created_at de los tags retenidos. A diferencia
// de setTripClients, un arreglo vacío es válido (0 tags permitido).
export async function setTripTags(tripId: string, tagIds: string[]): Promise<void> {
  if (!isSupabaseConfigured()) {
    const current = mockTripTags.filter((tt) => tt.tripId === tripId);
    const currentIds = new Set(current.map((tt) => tt.tagId));
    const nextIds = new Set(tagIds);

    for (let i = mockTripTags.length - 1; i >= 0; i--) {
      const tt = mockTripTags[i];
      if (tt.tripId === tripId && !nextIds.has(tt.tagId)) {
        mockTripTags.splice(i, 1);
      }
    }
    const now = Date.now();
    tagIds.forEach((tagId, idx) => {
      if (!currentIds.has(tagId)) {
        mockTripTags.push({ tripId, tagId, createdAt: new Date(now + idx).toISOString() });
      }
    });
    return;
  }

  const supabase = await createServerSupabase();
  const { data: currentRows, error: currentError } = await supabase
    .from("trip_tags")
    .select("tag_id")
    .eq("trip_id", tripId);
  if (currentError) throw currentError;

  const currentIds = new Set((currentRows ?? []).map((r) => r.tag_id as string));
  const nextIds = new Set(tagIds);
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));
  const toAdd = tagIds.filter((id) => !currentIds.has(id));

  if (toRemove.length) {
    const { error: removeError } = await supabase
      .from("trip_tags")
      .delete()
      .eq("trip_id", tripId)
      .in("tag_id", toRemove);
    if (removeError) throw removeError;
  }

  if (toAdd.length) {
    const { error: addError } = await supabase
      .from("trip_tags")
      .upsert(
        toAdd.map((tagId) => ({ trip_id: tripId, tag_id: tagId })),
        { onConflict: "trip_id,tag_id", ignoreDuplicates: true }
      );
    if (addError) throw addError;
  }
}

// ---------- Trips ----------

export type CreateTripInput = {
  clientIds: string[];
  title: string;
  slug: string;
  startDate?: string;
  endDate?: string;
  coverImageUrl?: string;
  instructions?: string;
  tagIds?: string[];
};

export type UpdateTripInput = Partial<{
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  coverImageUrl: string;
  instructions: string | null;
  status: Trip["status"];
  showCostsToClient: boolean;
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

// Query batcheada para el dashboard/list: trips + UN solo trip_clients.in()
// + UN solo clients.in() (sin N+1 por fila) y SIN cargar days/items/documents
// (solo lo que necesita la vista de lista). clients[] queda ordenado por
// created_at asc (orden de asignación), igual que assembleTripWithDetails.
export async function getTripsWithClients(): Promise<
  (Trip & { clients: Client[]; tags: Tag[] })[]
> {
  if (!isSupabaseConfigured()) {
    return mockTrips.map((trip) => ({
      ...trip,
      clients: mockTripClients
        .filter((tc) => tc.tripId === trip.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((tc) => mockClients.find((c) => c.id === tc.clientId))
        .filter((c): c is Client => Boolean(c)),
      tags: mockTripTags
        .filter((tt) => tt.tripId === trip.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((tt) => mockTags.find((t) => t.id === tt.tagId))
        .filter((t): t is Tag => Boolean(t)),
    }));
  }

  const supabase = await createServerSupabase();
  const { data: tripRows, error } = await supabase
    .from("trips")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const trips = (tripRows ?? []).map(rowToTrip);
  const tripIds = trips.map((t) => t.id);
  if (!tripIds.length) return [];

  const { data: linkRows, error: linksError } = await supabase
    .from("trip_clients")
    .select("trip_id, client_id, created_at")
    .in("trip_id", tripIds)
    .order("created_at", { ascending: true });
  if (linksError) throw linksError;

  const clientIds = [...new Set((linkRows ?? []).map((l) => l.client_id as string))];
  let clientsById = new Map<string, Client>();
  if (clientIds.length) {
    const { data: clientRows, error: clientsError } = await supabase
      .from("clients")
      .select("*")
      .in("id", clientIds);
    if (clientsError) throw clientsError;
    clientsById = new Map((clientRows ?? []).map((c) => [c.id as string, rowToClient(c)]));
  }

  const { data: tagLinkRows, error: tagLinksError } = await supabase
    .from("trip_tags")
    .select("trip_id, tag_id, created_at")
    .in("trip_id", tripIds)
    .order("created_at", { ascending: true });
  if (tagLinksError) throw tagLinksError;

  const tagIds = [...new Set((tagLinkRows ?? []).map((l) => l.tag_id as string))];
  let tagsById = new Map<string, Tag>();
  if (tagIds.length) {
    const { data: tagRows, error: tagsError } = await supabase
      .from("tags")
      .select("*")
      .in("id", tagIds);
    if (tagsError) throw tagsError;
    tagsById = new Map((tagRows ?? []).map((t) => [t.id as string, rowToTag(t)]));
  }

  return trips.map((trip) => ({
    ...trip,
    clients: (linkRows ?? [])
      .filter((l) => l.trip_id === trip.id)
      .map((l) => clientsById.get(l.client_id as string))
      .filter((c): c is Client => Boolean(c)),
    tags: (tagLinkRows ?? [])
      .filter((l) => l.trip_id === trip.id)
      .map((l) => tagsById.get(l.tag_id as string))
      .filter((t): t is Tag => Boolean(t)),
  }));
}

// Viajes en estado "draft" cuya fecha de inicio cae dentro de los próximos
// `withinDays` días (hoy incluido, pasado excluido). Reutiliza
// getTripsWithClients (ya trae clients/tags batcheados) y filtra en JS: no
// hay una columna derivada en la tabla, así que no se puede empujar el
// filtro de fecha a Supabase sin una función/columna generada.
export async function getUpcomingUnpublishedTrips(
  withinDays = 7
): Promise<(Trip & { clients: Client[]; tags: Tag[] })[]> {
  const trips = await getTripsWithClients();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + withinDays);

  return trips.filter((trip) => {
    if (trip.status !== "draft" || !trip.startDate) return false;
    const start = new Date(trip.startDate + "T00:00:00");
    return start >= today && start <= limit;
  });
}

// Devuelve todos los viajes asignados a un cliente vía trip_clients (fuente
// de verdad many-to-many), no solo los que tienen trips.client_id === clientId.
// Batch query (.in) para evitar N+1 al resolver los trips encontrados.
export async function getTripsByClientId(clientId: string): Promise<Trip[]> {
  if (!isSupabaseConfigured()) {
    const tripIds = new Set(
      mockTripClients.filter((tc) => tc.clientId === clientId).map((tc) => tc.tripId)
    );
    return mockTrips
      .filter((t) => tripIds.has(t.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const supabase = await createServerSupabase();
  const { data: links, error: linksError } = await supabase
    .from("trip_clients")
    .select("trip_id")
    .eq("client_id", clientId);
  if (linksError) throw linksError;
  const tripIds = (links ?? []).map((l) => l.trip_id as string);
  if (!tripIds.length) return [];
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .in("id", tripIds)
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

  // trip_clients es la fuente de verdad: se ordena por created_at asc
  // (orden de asignación) y luego se resuelven los clientes en un solo
  // batch .in() (sin N+1).
  const { data: linkRows, error: linksError } = await supabase
    .from("trip_clients")
    .select("client_id, created_at")
    .eq("trip_id", trip.id)
    .order("created_at", { ascending: true });
  if (linksError) throw linksError;

  const orderedClientIds = (linkRows ?? []).map((l) => l.client_id as string);
  let clients: Client[] = [];
  if (orderedClientIds.length) {
    const { data: clientRows, error: clientsError } = await supabase
      .from("clients")
      .select("*")
      .in("id", orderedClientIds);
    if (clientsError) throw clientsError;
    const byId = new Map((clientRows ?? []).map((c) => [c.id as string, rowToClient(c)]));
    clients = orderedClientIds
      .map((id) => byId.get(id))
      .filter((c): c is Client => Boolean(c));
  }
  const client = clients[0] ?? ({} as Client);

  // trip_tags: mismo patrón que trip_clients (ordenado por created_at asc,
  // resuelto en un solo batch .in()). 0 tags es válido, no lanza.
  const { data: tagLinkRows, error: tagLinksError } = await supabase
    .from("trip_tags")
    .select("tag_id, created_at")
    .eq("trip_id", trip.id)
    .order("created_at", { ascending: true });
  if (tagLinksError) throw tagLinksError;

  const orderedTagIds = (tagLinkRows ?? []).map((l) => l.tag_id as string);
  let tags: Tag[] = [];
  if (orderedTagIds.length) {
    const { data: tagRows, error: tagsError } = await supabase
      .from("tags")
      .select("*")
      .in("id", orderedTagIds);
    if (tagsError) throw tagsError;
    const tagById = new Map((tagRows ?? []).map((t) => [t.id as string, rowToTag(t)]));
    tags = orderedTagIds.map((id) => tagById.get(id)).filter((t): t is Tag => Boolean(t));
  }

  const { data: dayRows, error: daysError } = await supabase
    .from("trip_days")
    .select("*")
    .eq("trip_id", trip.id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });
  if (daysError) throw daysError;

  const dayIds = (dayRows ?? []).map((d) => d.id as string);
  let itemRows: Record<string, unknown>[] = [];
  if (dayIds.length) {
    const { data, error: itemsError } = await supabase
      .from("items")
      .select("*")
      .in("trip_day_id", dayIds)
      .is("deleted_at", null)
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
    clients,
    client,
    tags,
    days,
  };
}

// clientIds MUST have length >= 1. Rechaza ANTES de escribir cualquier fila
// (no debe quedar un trip persistido con cero clientes asignados).
// trips.client_id se sigue escribiendo como espejo de compatibilidad
// (clientIds[0]); trip_clients es la fuente de verdad para lecturas.
export async function createTrip(input: CreateTripInput): Promise<Trip> {
  if (!input.clientIds || input.clientIds.length < 1) {
    throw new Error("Se requiere al menos un cliente para crear el viaje");
  }
  if (!isSupabaseConfigured()) {
    const trip: Trip = {
      id: uid(),
      clientId: input.clientIds[0],
      title: input.title,
      slug: input.slug,
      startDate: input.startDate ?? "",
      endDate: input.endDate ?? "",
      coverImageUrl: input.coverImageUrl,
      instructions: input.instructions,
      status: "draft",
      showCostsToClient: false,
      createdAt: new Date().toISOString(),
    };
    mockTrips.unshift(trip);
    const now = new Date().toISOString();
    input.clientIds.forEach((clientId, idx) => {
      mockTripClients.push({
        tripId: trip.id,
        clientId,
        createdAt: new Date(Date.parse(now) + idx).toISOString(),
      });
    });
    (input.tagIds ?? []).forEach((tagId, idx) => {
      mockTripTags.push({
        tripId: trip.id,
        tagId,
        createdAt: new Date(Date.parse(now) + idx).toISOString(),
      });
    });
    return trip;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("trips")
    .insert({
      client_id: input.clientIds[0],
      title: input.title,
      slug: input.slug,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      cover_image_url: input.coverImageUrl,
      instructions: input.instructions ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  const trip = rowToTrip(data);

  const { error: linksError } = await supabase
    .from("trip_clients")
    .insert(input.clientIds.map((clientId) => ({ trip_id: trip.id, client_id: clientId })));
  if (linksError) throw linksError;

  if (input.tagIds?.length) {
    const { error: tagLinksError } = await supabase
      .from("trip_tags")
      .insert(input.tagIds.map((tagId) => ({ trip_id: trip.id, tag_id: tagId })));
    if (tagLinksError) throw tagLinksError;
  }

  return trip;
}

// Reemplaza el conjunto completo de clientes asignados a un viaje mediante
// un diff (borra los removidos + inserta los agregados con ON CONFLICT DO
// NOTHING), NO delete-all-then-reinsert, para preservar el created_at (orden
// de asignación) de los clientes retenidos. Rechaza si clientIds queda vacío
// (regla de mínimo 1 cliente aplica también en edición) dejando la
// asignación existente sin cambios.
export async function setTripClients(tripId: string, clientIds: string[]): Promise<void> {
  if (!clientIds || clientIds.length < 1) {
    throw new Error("Se requiere al menos un cliente asignado al viaje");
  }
  if (!isSupabaseConfigured()) {
    const current = mockTripClients.filter((tc) => tc.tripId === tripId);
    const currentIds = new Set(current.map((tc) => tc.clientId));
    const nextIds = new Set(clientIds);

    for (let i = mockTripClients.length - 1; i >= 0; i--) {
      const tc = mockTripClients[i];
      if (tc.tripId === tripId && !nextIds.has(tc.clientId)) {
        mockTripClients.splice(i, 1);
      }
    }
    const now = Date.now();
    clientIds.forEach((clientId, idx) => {
      if (!currentIds.has(clientId)) {
        mockTripClients.push({
          tripId,
          clientId,
          createdAt: new Date(now + idx).toISOString(),
        });
      }
    });

    const trip = mockTrips.find((t) => t.id === tripId);
    if (trip) trip.clientId = clientIds[0];
    return;
  }

  const supabase = await createServerSupabase();
  const { data: currentRows, error: currentError } = await supabase
    .from("trip_clients")
    .select("client_id")
    .eq("trip_id", tripId);
  if (currentError) throw currentError;

  const currentIds = new Set((currentRows ?? []).map((r) => r.client_id as string));
  const nextIds = new Set(clientIds);
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));
  const toAdd = clientIds.filter((id) => !currentIds.has(id));

  if (toRemove.length) {
    const { error: removeError } = await supabase
      .from("trip_clients")
      .delete()
      .eq("trip_id", tripId)
      .in("client_id", toRemove);
    if (removeError) throw removeError;
  }

  if (toAdd.length) {
    const { error: addError } = await supabase
      .from("trip_clients")
      .upsert(
        toAdd.map((clientId) => ({ trip_id: tripId, client_id: clientId })),
        { onConflict: "trip_id,client_id", ignoreDuplicates: true }
      );
    if (addError) throw addError;
  }

  const { error: mirrorError } = await supabase
    .from("trips")
    .update({ client_id: clientIds[0] })
    .eq("id", tripId);
  if (mirrorError) throw mirrorError;
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
    if (input.instructions !== undefined) trip.instructions = input.instructions ?? undefined;
    if (input.status !== undefined) trip.status = input.status;
    if (input.showCostsToClient !== undefined) trip.showCostsToClient = input.showCostsToClient;
    return trip;
  }
  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.endDate !== undefined) patch.end_date = input.endDate;
  if (input.coverImageUrl !== undefined) patch.cover_image_url = input.coverImageUrl;
  if (input.instructions !== undefined) patch.instructions = input.instructions;
  if (input.status !== undefined) patch.status = input.status;
  if (input.showCostsToClient !== undefined) patch.show_costs_to_client = input.showCostsToClient;
  const { data, error } = await supabase.from("trips").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return rowToTrip(data);
}

function rowToTrip(row: Record<string, unknown>): Trip {
  return {
    id: row.id as string,
    clientId: (row.client_id as string) ?? "",
    title: row.title as string,
    slug: row.slug as string,
    startDate: (row.start_date as string) ?? "",
    endDate: (row.end_date as string) ?? "",
    coverImageUrl: (row.cover_image_url as string) ?? undefined,
    instructions: (row.instructions as string) ?? undefined,
    status: row.status as Trip["status"],
    showCostsToClient: Boolean(row.show_costs_to_client),
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

// Soft delete (issue #23): marca deleted_at en vez de borrar la fila, para
// poder deshacer dentro de la misma sesión (toast "Deshacer"). Los items de
// ese día NO se marcan individualmente: quedan ocultos porque las consultas
// de lectura (assembleTripWithDetails / mock getTripWithDetails) ya excluyen
// items cuyo trip_day padre está soft-deleted.
export async function deleteTripDay(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const day = mockTripDays.find((d) => d.id === id);
    if (day) day.deletedAt = new Date().toISOString();
    return;
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("trip_days")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function restoreTripDay(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const day = mockTripDays.find((d) => d.id === id);
    if (day) day.deletedAt = undefined;
    return;
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("trip_days").update({ deleted_at: null }).eq("id", id);
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
  cost?: number;
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
      cost: input.cost,
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
      cost: input.cost ?? null,
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
  if (input.cost !== undefined) patch.cost = input.cost ?? null;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  const { data, error } = await supabase.from("items").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return rowToItem(data);
}

// Soft delete (issue #23): ver comentario de deleteTripDay.
export async function deleteItem(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const item = mockItems.find((i) => i.id === id);
    if (item) item.deletedAt = new Date().toISOString();
    return;
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function restoreItem(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const item = mockItems.find((i) => i.id === id);
    if (item) item.deletedAt = undefined;
    return;
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("items").update({ deleted_at: null }).eq("id", id);
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
    cost: row.cost !== null && row.cost !== undefined ? Number(row.cost) : undefined,
    sortOrder: row.sort_order as number,
  };
}

// ---------- Documents ----------

const DOCUMENTS_BUCKET = "trip-documents";

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
  const { data: row } = await supabase.from("documents").select("file_url").eq("id", id).maybeSingle();
  if (row?.file_url) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([row.file_url as string]);
  }
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw error;
}

// Sube un archivo al bucket privado "trip-documents" (ver
// supabase/migrations/0002_storage_bucket.sql) y registra el documento.
// Requiere Supabase configurado; si no, lanza para que la UI muestre el
// mensaje de "configura Supabase" en vez de fallar en silencio.
export async function uploadItemDocument(itemId: string, file: File): Promise<ItemDocument> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase no está configurado; no se pueden subir documentos.");
  }
  const supabase = await createServerSupabase();
  const path = `${itemId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (uploadError) throw uploadError;
  return createDocument({ itemId, fileUrl: path, fileName: file.name });
}

// Genera una URL firmada de corta duración para descargar/ver un documento
// privado. Devuelve null si Supabase no está configurado o si falla.
export async function getSignedDocumentUrl(path: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function getItemDocuments(
  itemId: string
): Promise<(ItemDocument & { url: string | null })[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("documents").select("*").eq("item_id", itemId);
  if (error) throw error;
  return Promise.all(
    (data ?? []).map(async (row) => {
      const doc = rowToDocument(row);
      const url = await getSignedDocumentUrl(doc.fileUrl);
      return { ...doc, url };
    })
  );
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

// ---------- Site settings (contacto público, fila singleton) ----------

export async function getSiteSettings(): Promise<SiteSettings> {
  if (!isSupabaseConfigured()) return mockSiteSettings;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToSiteSettings(data) : { email: "", phone: "" };
}

export async function updateSiteSettings(
  input: Partial<SiteSettings>
): Promise<SiteSettings> {
  if (!isSupabaseConfigured()) {
    if (input.email !== undefined) mockSiteSettings.email = input.email;
    if (input.phone !== undefined) mockSiteSettings.phone = input.phone;
    return mockSiteSettings;
  }
  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = { id: 1 };
  if (input.email !== undefined) patch.email = input.email;
  if (input.phone !== undefined) patch.phone = input.phone;
  const { data, error } = await supabase
    .from("site_settings")
    .upsert(patch)
    .select()
    .single();
  if (error) throw error;
  return rowToSiteSettings(data);
}

function rowToSiteSettings(row: Record<string, unknown>): SiteSettings {
  return {
    email: (row.email as string) ?? "",
    phone: (row.phone as string) ?? "",
  };
}
