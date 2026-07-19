import { Client, Item, ItemDocument, PackingItem, SiteSettings, Tag, Trip, TripDay, TripPhoto, TripWithDetails } from "@/types";
import {
  mockClients,
  mockTrips,
  mockTripDays,
  mockItems,
  mockSiteSettings,
  mockTripClients,
  mockTags,
  mockTripTags,
  mockTripPhotos,
  mockPackingItems,
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

// ---------- Pagination ----------

export const DEFAULT_PAGE_SIZE = 20;

// Para selectores que necesitan el catálogo completo de clientes (asignar
// cliente a un viaje), no la página paginada del dashboard. Un solo agente
// de viajes no maneja miles de clientes, así que un límite alto basta.
export const ALL_CLIENTS_PAGE_SIZE = 1000;

// Mismo criterio que ALL_CLIENTS_PAGE_SIZE, para agregados internos
// (KPIs, alertas) que necesitan escanear todos los viajes en memoria.
export const ALL_TRIPS_PAGE_SIZE = 1000;

export type PaginationParams = { page?: number; pageSize?: number };
export type PaginatedResult<T> = { items: T[]; totalCount: number };

function paginationBounds(params: PaginationParams) {
  const page = params.page && params.page > 0 ? params.page : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : DEFAULT_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}

// ---------- Clients ----------

export type CreateClientInput = {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
};

export async function getClients(params: PaginationParams = {}): Promise<PaginatedResult<Client>> {
  const { from, to, pageSize } = paginationBounds(params);
  if (!isSupabaseConfigured()) {
    return { items: mockClients.slice(from, from + pageSize), totalCount: mockClients.length };
  }
  const supabase = await createServerSupabase();
  const { data, error, count } = await supabase
    .from("clients")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { items: data.map(rowToClient), totalCount: count ?? 0 };
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
export async function getClientsWithTags(
  params: PaginationParams = {}
): Promise<PaginatedResult<Client & { tags: Tag[] }>> {
  const { from, to, pageSize } = paginationBounds(params);

  if (!isSupabaseConfigured()) {
    const pageClients = mockClients.slice(from, from + pageSize);
    return {
      items: pageClients.map((client) => ({
        ...client,
        tags: mockClientTags
          .filter((ct) => ct.clientId === client.id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((ct) => mockTags.find((t) => t.id === ct.tagId))
          .filter((t): t is Tag => Boolean(t)),
      })),
      totalCount: mockClients.length,
    };
  }

  const supabase = await createServerSupabase();
  const { data: clientRows, error, count } = await supabase
    .from("clients")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;

  const clients = (clientRows ?? []).map(rowToClient);
  const clientIds = clients.map((c) => c.id);
  const totalCount = count ?? 0;
  if (!clientIds.length) return { items: [], totalCount };

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

  return {
    items: clients.map((client) => ({
      ...client,
      tags: (tagLinkRows ?? [])
        .filter((l) => l.client_id === client.id)
        .map((l) => tagsById.get(l.tag_id as string))
        .filter((t): t is Tag => Boolean(t)),
    })),
    totalCount,
  };
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
  // Opcional solo para plantillas (isTemplate: true), que no tienen cliente
  // asociado. Un viaje normal sigue requiriendo al menos un cliente.
  clientIds?: string[];
  title: string;
  slug: string;
  startDate?: string;
  endDate?: string;
  coverImageUrl?: string;
  instructions?: string;
  tagIds?: string[];
  isTemplate?: boolean;
};

export type UpdateTripInput = Partial<{
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  coverImageUrl: string;
  instructions: string | null;
  budget: number | null;
  status: Trip["status"];
  showCostsToClient: boolean;
}>;

export async function getTrips(params: PaginationParams = {}): Promise<PaginatedResult<Trip>> {
  const { from, to, pageSize } = paginationBounds(params);
  if (!isSupabaseConfigured()) {
    const nonTemplateTrips = mockTrips.filter((t) => !t.isTemplate);
    return {
      items: nonTemplateTrips.slice(from, from + pageSize),
      totalCount: nonTemplateTrips.length,
    };
  }
  const supabase = await createServerSupabase();
  const { data, error, count } = await supabase
    .from("trips")
    .select("*", { count: "exact" })
    .eq("is_template", false)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { items: data.map(rowToTrip), totalCount: count ?? 0 };
}

// Viajes marcados como plantilla (issue #31): estructura de días/items
// reusable, sin cliente asociado. Se listan aparte de getTrips() (que las
// excluye) para el selector de "crear desde plantilla".
export async function getTemplates(): Promise<Trip[]> {
  if (!isSupabaseConfigured()) {
    return mockTrips
      .filter((t) => t.isTemplate)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("is_template", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(rowToTrip);
}

// Query batcheada para el dashboard/list: trips + UN solo trip_clients.in()
// + UN solo clients.in() (sin N+1 por fila) y SIN cargar days/items/documents
// (solo lo que necesita la vista de lista). clients[] queda ordenado por
// created_at asc (orden de asignación), igual que assembleTripWithDetails.
export async function getTripsWithClients(
  params: PaginationParams = {}
): Promise<PaginatedResult<Trip & { clients: Client[]; tags: Tag[] }>> {
  const { from, to, pageSize } = paginationBounds(params);

  if (!isSupabaseConfigured()) {
    const nonTemplateTrips = mockTrips.filter((trip) => !trip.isTemplate);
    const pageTrips = nonTemplateTrips.slice(from, from + pageSize);
    return {
      items: pageTrips.map((trip) => ({
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
      })),
      totalCount: nonTemplateTrips.length,
    };
  }

  const supabase = await createServerSupabase();
  const { data: tripRows, error, count } = await supabase
    .from("trips")
    .select("*", { count: "exact" })
    .eq("is_template", false)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;

  const trips = (tripRows ?? []).map(rowToTrip);
  const totalCount = count ?? 0;
  const tripIds = trips.map((t) => t.id);
  if (!tripIds.length) return { items: [], totalCount };

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

  return {
    items: trips.map((trip) => ({
      ...trip,
      clients: (linkRows ?? [])
        .filter((l) => l.trip_id === trip.id)
        .map((l) => clientsById.get(l.client_id as string))
        .filter((c): c is Client => Boolean(c)),
      tags: (tagLinkRows ?? [])
        .filter((l) => l.trip_id === trip.id)
        .map((l) => tagsById.get(l.tag_id as string))
        .filter((t): t is Tag => Boolean(t)),
    })),
    totalCount,
  };
}

// Viajes en estado "draft" cuya fecha de inicio cae dentro de los próximos
// `withinDays` días (hoy incluido, pasado excluido). Reutiliza
// getTripsWithClients (ya trae clients/tags batcheados) y filtra en JS: no
// hay una columna derivada en la tabla, así que no se puede empujar el
// filtro de fecha a Supabase sin una función/columna generada.
export async function getUpcomingUnpublishedTrips(
  withinDays = 7
): Promise<(Trip & { clients: Client[]; tags: Tag[] })[]> {
  const { items: trips } = await getTripsWithClients({ pageSize: ALL_TRIPS_PAGE_SIZE });
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

  const { data: photoRows, error: photosError } = await supabase
    .from("trip_photos")
    .select("*")
    .eq("trip_id", trip.id)
    .order("sort_order", { ascending: true });
  if (photosError) throw photosError;
  const photos = (photoRows ?? []).map((row) => {
    const photo = rowToTripPhoto(row);
    const { data: publicUrlData } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(photo.filePath);
    return { ...photo, url: publicUrlData.publicUrl };
  });

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

  const { data: packingRows, error: packingError } = await supabase
    .from("packing_items")
    .select("*")
    .eq("trip_id", trip.id)
    .order("sort_order", { ascending: true });
  if (packingError) throw packingError;
  const packingItems = (packingRows ?? []).map(rowToPackingItem);

  return {
    ...trip,
    clients,
    client,
    tags,
    photos,
    days,
    packingItems,
  };
}

// clientIds MUST have length >= 1. Rechaza ANTES de escribir cualquier fila
// (no debe quedar un trip persistido con cero clientes asignados).
// trips.client_id se sigue escribiendo como espejo de compatibilidad
// (clientIds[0]); trip_clients es la fuente de verdad para lecturas.
export async function createTrip(input: CreateTripInput): Promise<Trip> {
  const isTemplate = input.isTemplate ?? false;
  const clientIds = input.clientIds ?? [];
  if (!isTemplate && clientIds.length < 1) {
    throw new Error("Se requiere al menos un cliente para crear el viaje");
  }
  if (!isSupabaseConfigured()) {
    const trip: Trip = {
      id: uid(),
      clientId: clientIds[0] ?? "",
      title: input.title,
      slug: input.slug,
      startDate: input.startDate ?? "",
      endDate: input.endDate ?? "",
      coverImageUrl: input.coverImageUrl,
      instructions: input.instructions,
      status: "draft",
      isTemplate,
      showCostsToClient: false,
      createdAt: new Date().toISOString(),
    };
    mockTrips.unshift(trip);
    const now = new Date().toISOString();
    clientIds.forEach((clientId, idx) => {
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
      client_id: clientIds[0] ?? null,
      title: input.title,
      slug: input.slug,
      start_date: input.startDate || null,
      end_date: input.endDate || null,
      cover_image_url: input.coverImageUrl,
      instructions: input.instructions ?? null,
      is_template: isTemplate,
    })
    .select()
    .single();
  if (error) throw error;
  const trip = rowToTrip(data);

  if (clientIds.length) {
    const { error: linksError } = await supabase
      .from("trip_clients")
      .insert(clientIds.map((clientId) => ({ trip_id: trip.id, client_id: clientId })));
    if (linksError) throw linksError;
  }

  if (input.tagIds?.length) {
    const { error: tagLinksError } = await supabase
      .from("trip_tags")
      .insert(input.tagIds.map((tagId) => ({ trip_id: trip.id, tag_id: tagId })));
    if (tagLinksError) throw tagLinksError;
  }

  return trip;
}

// Copia días + items (sin documentos, issue #31) de un viaje/plantilla origen
// hacia un viaje destino recién creado. Reusa createTripDay/createItem (que
// ya manejan mock/Supabase) en vez de duplicar esa lógica aquí.
async function copyTripDaysAndItems(sourceTripId: string, destTripId: string): Promise<void> {
  const source = await getTripById(sourceTripId);
  if (!source) throw new Error("Viaje origen no encontrado");
  for (const day of source.days) {
    const newDay = await createTripDay({
      tripId: destTripId,
      date: day.date,
      notes: day.notes,
      sortOrder: day.sortOrder,
    });
    for (const item of day.items) {
      await createItem({
        tripDayId: newDay.id,
        type: item.type,
        title: item.title,
        startTime: item.startTime,
        endTime: item.endTime,
        location: item.location,
        lat: item.lat,
        lng: item.lng,
        confirmationCode: item.confirmationCode,
        notes: item.notes,
        sortOrder: item.sortOrder,
      });
    }
  }
}

function templateSlug(title: string): string {
  const base =
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "plantilla";
  return `plantilla-${base}-${Date.now().toString(36)}`;
}

// Guarda la estructura de días/items de un viaje existente como una nueva
// plantilla (is_template = true, sin cliente). No copia documentos.
export async function saveTripAsTemplate(tripId: string, title: string): Promise<Trip> {
  const template = await createTrip({ title, slug: templateSlug(title), isTemplate: true });
  await copyTripDaysAndItems(tripId, template.id);
  return template;
}

// Crea un viaje normal (requiere clientIds como createTrip) y le copia la
// estructura de días/items de una plantilla existente.
export async function createTripFromTemplate(
  templateId: string,
  input: CreateTripInput
): Promise<Trip> {
  const trip = await createTrip(input);
  await copyTripDaysAndItems(templateId, trip.id);
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
    if (input.budget !== undefined) trip.budget = input.budget ?? undefined;
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
  if (input.budget !== undefined) patch.budget = input.budget;
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
    budget: row.budget !== null && row.budget !== undefined ? Number(row.budget) : undefined,
    status: row.status as Trip["status"],
    isTemplate: Boolean(row.is_template),
    showCostsToClient: Boolean(row.show_costs_to_client),
    createdAt: row.created_at as string,
  };
}

// ---------- Packing list (issue #24) ----------

export type CreatePackingItemInput = { tripId: string; label: string; sortOrder?: number };
export type UpdatePackingItemInput = Partial<{ label: string; checked: boolean; sortOrder: number }>;

export async function createPackingItem(input: CreatePackingItemInput): Promise<PackingItem> {
  if (!isSupabaseConfigured()) {
    const item: PackingItem = {
      id: uid(),
      tripId: input.tripId,
      label: input.label,
      checked: false,
      sortOrder:
        input.sortOrder ?? mockPackingItems.filter((p) => p.tripId === input.tripId).length,
    };
    mockPackingItems.push(item);
    return item;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("packing_items")
    .insert({
      trip_id: input.tripId,
      label: input.label,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToPackingItem(data);
}

export async function updatePackingItem(
  id: string,
  input: UpdatePackingItemInput
): Promise<PackingItem> {
  if (!isSupabaseConfigured()) {
    const item = mockPackingItems.find((p) => p.id === id);
    if (!item) throw new Error("Item de equipaje no encontrado");
    if (input.label !== undefined) item.label = input.label;
    if (input.checked !== undefined) item.checked = input.checked;
    if (input.sortOrder !== undefined) item.sortOrder = input.sortOrder;
    return item;
  }
  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.checked !== undefined) patch.checked = input.checked;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  const { data, error } = await supabase
    .from("packing_items")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToPackingItem(data);
}

export async function deletePackingItem(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const idx = mockPackingItems.findIndex((p) => p.id === id);
    if (idx >= 0) mockPackingItems.splice(idx, 1);
    return;
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("packing_items").delete().eq("id", id);
  if (error) throw error;
}

function rowToPackingItem(row: Record<string, unknown>): PackingItem {
  return {
    id: row.id as string,
    tripId: row.trip_id as string,
    label: row.label as string,
    checked: row.checked as boolean,
    sortOrder: row.sort_order as number,
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

// ---------- Trip photos (galería pública) ----------

// Bucket público (a diferencia de "trip-documents", privado): las fotos
// están pensadas para verse en /t/{slug}, ver
// supabase/migrations/0012_trip_photos.sql.
const PHOTOS_BUCKET = "trip-photos";

function rowToTripPhoto(row: Record<string, unknown>): TripPhoto {
  return {
    id: row.id as string,
    tripId: row.trip_id as string,
    filePath: row.file_path as string,
    fileName: row.file_name as string,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
  };
}

export async function getTripPhotos(
  tripId: string
): Promise<(TripPhoto & { url: string | null })[]> {
  if (!isSupabaseConfigured()) {
    return mockTripPhotos
      .filter((p) => p.tripId === tripId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => ({ ...p, url: p.filePath }));
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("trip_photos")
    .select("*")
    .eq("trip_id", tripId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const photo = rowToTripPhoto(row);
    const { data: publicUrlData } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(photo.filePath);
    return { ...photo, url: publicUrlData.publicUrl };
  });
}

// Sube una imagen al bucket público "trip-photos" (ver
// supabase/migrations/0012_trip_photos.sql) y registra la foto. Requiere
// Supabase configurado; si no, lanza para que la UI muestre el mensaje de
// "configura Supabase" en vez de fallar en silencio (mismo patrón que
// uploadItemDocument).
export async function uploadTripPhoto(tripId: string, file: File): Promise<TripPhoto> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase no está configurado; no se pueden subir fotos.");
  }
  const supabase = await createServerSupabase();
  const path = `${tripId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (uploadError) throw uploadError;

  const { count } = await supabase
    .from("trip_photos")
    .select("*", { count: "exact", head: true })
    .eq("trip_id", tripId);

  const { data, error } = await supabase
    .from("trip_photos")
    .insert({
      trip_id: tripId,
      file_path: path,
      file_name: file.name,
      sort_order: count ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToTripPhoto(data);
}

export async function deleteTripPhoto(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await createServerSupabase();
  const { data: row } = await supabase
    .from("trip_photos")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  if (row?.file_path) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([row.file_path as string]);
  }
  const { error } = await supabase.from("trip_photos").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Dashboard stats ----------

export type TripStats = {
  byStatus: Record<Trip["status"], number>;
  upcomingNext7: number;
  upcomingNext30: number;
  newClientsThisMonth: number;
  unpublishedNearStart: number;
};

// Se apoya en getTrips()/getClients() (ya cubren el modo dual mock/Supabase),
// pidiendo el catálogo completo vía ALL_*_PAGE_SIZE, y calcula los conteos en
// JS: al ser una sola cuenta de agente, el volumen de trips/clients es bajo y
// no justifica duplicar el branching de isSupabaseConfigured() con queries
// agregadas.
export async function getTripStats(): Promise<TripStats> {
  const [{ items: trips }, { items: clients }] = await Promise.all([
    getTrips({ pageSize: ALL_TRIPS_PAGE_SIZE }),
    getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE }),
  ]);

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const byStatus: Record<Trip["status"], number> = { draft: 0, published: 0, archived: 0 };
  let upcomingNext7 = 0;
  let upcomingNext30 = 0;
  let unpublishedNearStart = 0;

  for (const trip of trips) {
    byStatus[trip.status] = (byStatus[trip.status] ?? 0) + 1;

    const start = trip.startDate ? new Date(trip.startDate) : null;
    const hasValidStart = start !== null && !Number.isNaN(start.getTime());

    if (hasValidStart && start! >= now && start! <= in7Days) upcomingNext7++;
    if (hasValidStart && start! >= now && start! <= in30Days) upcomingNext30++;
    if (trip.status === "draft" && hasValidStart && start! >= now && start! <= in30Days) {
      unpublishedNearStart++;
    }
  }

  const newClientsThisMonth = clients.filter((client) => {
    const created = new Date(client.createdAt);
    return !Number.isNaN(created.getTime()) && created >= startOfMonth;
  }).length;

  return { byStatus, upcomingNext7, upcomingNext30, newClientsThisMonth, unpublishedNearStart };
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
