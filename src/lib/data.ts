import { sanitizeNote } from "@/lib/sanitize";
import {
  Client,
  ClientDocument,
  Item,
  ItemDocument,
  ItemWithSupplier,
  PackingItem,
  SiteSettings,
  Supplier,
  Tag,
  Trip,
  TripDay,
  TripFeedback,
  TripFilters,
  TripPhoto,
  TripStatusHistoryEntry,
  TripWithDetails,
} from "@/types";
import {
  mockClients,
  mockTrips,
  mockTripDays,
  mockItems,
  mockSiteSettings,
  mockTripClients,
  mockTags,
  mockTripTags,
  mockTripInternalNotes,
  mockTripStatusHistory,
  mockTripFeedback,
  mockTripPhotos,
  mockPackingItems,
  mockClientTags,
  mockSuppliers,
  getTripWithDetails as mockGetTripWithDetails,
} from "@/lib/mock-data";
import { createClient as createServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { slugify } from "@/lib/slugify";
import { hasActiveTripFilters, tripMatchesFilters } from "@/lib/trip-filters";

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
  referralSource?: string;
  birthDate?: string;
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

// Genera el slug público (/c/{slug}) con el mismo helper y patrón que el
// slug de viajes (slugBase + "-" + timestamp base36), ver
// src/app/dashboard/trips/new/actions.ts. Sin backfill para clientes
// existentes: solo se asigna al crear.
function generateClientSlug(name: string): string {
  const base = slugify(name) || "cliente";
  return `${base}-${Date.now().toString(36)}`;
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  if (!isSupabaseConfigured()) {
    const now = new Date().toISOString();
    const client: Client = {
      id: uid(),
      name: input.name,
      slug: generateClientSlug(input.name),
      email: input.email ?? "",
      phone: input.phone ?? "",
      notes: input.notes,
      referralSource: input.referralSource ?? null,
      birthDate: input.birthDate,
      createdAt: now,
      updatedAt: now,
    };
    mockClients.unshift(client);
    return client;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: input.name,
      slug: generateClientSlug(input.name),
      email: input.email,
      phone: input.phone,
      notes: input.notes,
      referral_source: input.referralSource,
      birth_date: input.birthDate || null,
    })
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
    if (input.notes !== undefined) client.notes = sanitizeNote(input.notes);
    if (input.referralSource !== undefined) client.referralSource = input.referralSource || null;
    if (input.birthDate !== undefined) client.birthDate = input.birthDate;
    client.updatedAt = new Date().toISOString();
    return client;
  }
  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.email !== undefined) patch.email = input.email;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.referralSource !== undefined) patch.referral_source = input.referralSource || null;
  if (input.birthDate !== undefined) patch.birth_date = input.birthDate || null;
  const { data, error } = await supabase.from("clients").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return rowToClient(data);
}

function rowToClient(row: Record<string, unknown>): Client {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: (row.slug as string) ?? undefined,
    email: (row.email as string) ?? "",
    phone: (row.phone as string) ?? "",
    notes: (row.notes as string) ?? undefined,
    referralSource: (row.referral_source as string) ?? null,
    birthDate: (row.birth_date as string) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? (row.created_at as string),
  };
}

// Cuenta clientes por referral_source para el widget de desglose del
// dashboard. null/"" se agrupa bajo la clave "" (el caller la muestra como
// "Sin especificar").
export async function getClientReferralSourceCounts(): Promise<Record<string, number>> {
  const { items: clients } = await getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE });
  const counts: Record<string, number> = {};
  for (const client of clients) {
    const key = client.referralSource?.trim() || "";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

// Calcula en cuántos días cae la próxima ocurrencia del cumpleaños (solo
// mes/día, ignorando el año de nacimiento) a partir de `from`. Si el
// mes/día ya pasó este año, se proyecta al año siguiente (wraparound
// dic->ene). Usa Date.UTC para comparar solo fechas de calendario, sin
// que la hora/zona horaria del server desplace el resultado en ±1 día.
function daysUntilNextBirthday(birthDate: string, from: Date): number {
  const [, month, day] = birthDate.split("-").map(Number);
  const fromUTC = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  let nextUTC = Date.UTC(from.getFullYear(), month - 1, day);
  if (nextUTC < fromUTC) {
    nextUTC = Date.UTC(from.getFullYear() + 1, month - 1, day);
  }
  return Math.round((nextUTC - fromUTC) / 86_400_000);
}

export type ClientWithUpcomingBirthday = Omit<Client, "birthDate"> & {
  birthDate: string;
  daysUntilBirthday: number;
};

// Clientes con birth_date cuyo cumpleaños (mes/día) cae dentro de los
// próximos `daysAhead` días (incluye hoy = 0). Se apoya en getClients(),
// que ya cubre el modo dual mock/Supabase, en vez de duplicar ese
// branching: esta función es una derivación pura sobre esos datos.
export async function getUpcomingBirthdays(daysAhead = 30): Promise<ClientWithUpcomingBirthday[]> {
  const { items: clients } = await getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE });
  const today = new Date();
  return clients
    .filter((client): client is Client & { birthDate: string } => Boolean(client.birthDate))
    .map((client) => ({
      ...client,
      daysUntilBirthday: daysUntilNextBirthday(client.birthDate, today),
    }))
    .filter((client) => client.daysUntilBirthday <= daysAhead)
    .sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday);
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
      notes: input.notes,
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
      notes: input.notes || null,
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

function rowToSupplier(row: Record<string, unknown>): Supplier {
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
    notes: (row.notes as string) ?? undefined,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    deletedAt: (row.deleted_at as string) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? (row.created_at as string),
  };
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
  travelerCount?: number;
  tagIds?: string[];
  currency?: Trip["currency"];
  isTemplate?: boolean;
};

export type UpdateTripInput = Partial<{
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  coverImageUrl: string;
  instructions: string | null;
  travelerCount: number;
  budget: number | null;
  status: Trip["status"];
  currency: Trip["currency"];
  showCostsToClient: boolean;
  salePrice: number | null;
  commissionRate: number | null;
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
export type TripsWithClientsParams = PaginationParams & { filters?: Partial<TripFilters> };

export async function getTripsWithClients(
  params: TripsWithClientsParams = {}
): Promise<PaginatedResult<Trip & { clients: Client[]; tags: Tag[] }>> {
  const filters = params.filters ?? {};
  const { from, to, pageSize } = paginationBounds(params);

  if (!isSupabaseConfigured()) {
    const filteredTrips = mockTrips
      .filter((trip) => !trip.isTemplate)
      .map((trip) => hydrateMockTripListItem(trip))
      .filter((trip) => tripMatchesFilters(trip, filters));
    const pageTrips = filteredTrips.slice(from, from + pageSize);
    return { items: pageTrips, totalCount: filteredTrips.length };
  }

  const supabase = await createServerSupabase();
  const matchingTripIds = hasActiveTripFilters(filters)
    ? await getSupabaseTripIdsForFilters(supabase, filters)
    : null;

  if (matchingTripIds?.size === 0) return { items: [], totalCount: 0 };

  let query = supabase
    .from("trips")
    .select("*", { count: "exact" })
    .eq("is_template", false);

  if (filters.status?.length) query = query.in("status", filters.status);
  if (filters.currency) query = query.eq("currency", filters.currency);
  if (filters.dateFrom) query = query.gte("end_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("start_date", filters.dateTo);
  if (matchingTripIds) query = query.in("id", [...matchingTripIds]);

  const { data: tripRows, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;

  const trips = (tripRows ?? []).map(rowToTrip);
  const totalCount = count ?? 0;
  const tripIds = trips.map((trip) => trip.id);
  if (!tripIds.length) return { items: [], totalCount };

  const { linkRows, clientsById, tagLinkRows, tagsById } = await loadTripRelations(supabase, tripIds);

  return {
    items: trips.map((trip) => ({
      ...trip,
      clients: (linkRows ?? [])
        .filter((link) => link.trip_id === trip.id)
        .map((link) => clientsById.get(link.client_id as string))
        .filter((client): client is Client => Boolean(client)),
      tags: (tagLinkRows ?? [])
        .filter((link) => link.trip_id === trip.id)
        .map((link) => tagsById.get(link.tag_id as string))
        .filter((tag): tag is Tag => Boolean(tag)),
    })),
    totalCount,
  };
}

function hydrateMockTripListItem(trip: Trip): Trip & { clients: Client[]; tags: Tag[]; internalNotes?: string | null } {
  return {
    ...trip,
    clients: mockTripClients
      .filter((link) => link.tripId === trip.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((link) => mockClients.find((client) => client.id === link.clientId))
      .filter((client): client is Client => Boolean(client)),
    tags: mockTripTags
      .filter((link) => link.tripId === trip.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((link) => mockTags.find((tag) => tag.id === link.tagId))
      .filter((tag): tag is Tag => Boolean(tag)),
    internalNotes: mockTripInternalNotes[trip.id] ?? null,
  };
}

function intersectTripIds(current: Set<string> | null, next: Set<string>) {
  if (current === null) return next;
  return new Set([...current].filter((id) => next.has(id)));
}

function escapeIlike(value: string) {
  return value.replace(/[%,_*]/g, " ").trim();
}

async function getSupabaseTripIdsForFilters(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  filters: Partial<TripFilters>,
) {
  let matchingTripIds: Set<string> | null = null;

  if (filters.clientIds?.length) {
    const { data, error } = await supabase
      .from("trip_clients")
      .select("trip_id")
      .in("client_id", filters.clientIds);
    if (error) throw error;
    matchingTripIds = intersectTripIds(
      matchingTripIds,
      new Set((data ?? []).map((row) => row.trip_id as string)),
    );
  }

  if (filters.tagIds?.length) {
    const { data, error } = await supabase
      .from("trip_tags")
      .select("trip_id")
      .in("tag_id", filters.tagIds);
    if (error) throw error;
    matchingTripIds = intersectTripIds(
      matchingTripIds,
      new Set((data ?? []).map((row) => row.trip_id as string)),
    );
  }

  const q = escapeIlike(filters.query?.trim() ?? "");
  if (q) {
    const [tripMatches, clientMatches] = await Promise.all([
      supabase
        .from("trips")
        .select("id")
        .or(`title.ilike.%${q}%,instructions.ilike.%${q}%,internal_notes.ilike.%${q}%`),
      supabase.from("clients").select("id").ilike("name", `%${q}%`),
    ]);
    if (tripMatches.error) throw tripMatches.error;
    if (clientMatches.error) throw clientMatches.error;

    const clientIds = (clientMatches.data ?? []).map((row) => row.id as string);
    let clientTripIds: string[] = [];
    if (clientIds.length) {
      const { data, error } = await supabase
        .from("trip_clients")
        .select("trip_id")
        .in("client_id", clientIds);
      if (error) throw error;
      clientTripIds = (data ?? []).map((row) => row.trip_id as string);
    }

    matchingTripIds = intersectTripIds(
      matchingTripIds,
      new Set([
        ...(tripMatches.data ?? []).map((row) => row.id as string),
        ...clientTripIds,
      ]),
    );
  }

  return matchingTripIds;
}

async function loadTripRelations(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  tripIds: string[],
) {
  const { data: linkRows, error: linksError } = await supabase
    .from("trip_clients")
    .select("trip_id, client_id, created_at")
    .in("trip_id", tripIds)
    .order("created_at", { ascending: true });
  if (linksError) throw linksError;

  const clientIds = [...new Set((linkRows ?? []).map((link) => link.client_id as string))];
  let clientsById = new Map<string, Client>();
  if (clientIds.length) {
    const { data: clientRows, error: clientsError } = await supabase
      .from("clients")
      .select("*")
      .in("id", clientIds);
    if (clientsError) throw clientsError;
    clientsById = new Map((clientRows ?? []).map((client) => [client.id as string, rowToClient(client)]));
  }

  const { data: tagLinkRows, error: tagLinksError } = await supabase
    .from("trip_tags")
    .select("trip_id, tag_id, created_at")
    .in("trip_id", tripIds)
    .order("created_at", { ascending: true });
  if (tagLinksError) throw tagLinksError;

  const tagIds = [...new Set((tagLinkRows ?? []).map((link) => link.tag_id as string))];
  let tagsById = new Map<string, Tag>();
  if (tagIds.length) {
    const { data: tagRows, error: tagsError } = await supabase
      .from("tags")
      .select("*")
      .in("id", tagIds);
    if (tagsError) throw tagsError;
    tagsById = new Map((tagRows ?? []).map((tag) => [tag.id as string, rowToTag(tag)]));
  }

  return { linkRows, clientsById, tagLinkRows, tagsById };
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

export type ClientTripSummary = {
  totalTrips: number;
  publishedCount: number;
  draftCount: number;
  archivedCount: number;
  // Null porque items/trips no tienen un campo de costo hoy (ver issue #25,
  // aún no mergeado). Si ese campo llega a existir, sumarlo aquí.
  totalCost: number | null;
};

// Resumen agregado para la vista de detalle de cliente (issue #41). Se apoya
// en getTripsByClientId para respetar el modo mock/Supabase sin duplicar
// lógica de acceso a datos.
export async function getClientTripSummary(clientId: string): Promise<ClientTripSummary> {
  const trips = await getTripsByClientId(clientId);
  return {
    totalTrips: trips.length,
    publishedCount: trips.filter((t) => t.status === "published").length,
    draftCount: trips.filter((t) => t.status === "draft").length,
    archivedCount: trips.filter((t) => t.status === "archived").length,
    totalCost: null,
  };
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

// Vista pública /t/[slug]: NUNCA selecciona ni expone sale_price/commission_rate
// (issue #53, campos exclusivos del editor del agente). A diferencia de
// getTripById, no usa select("*") — lista explícita de columnas públicas.
export async function getTripWithDetails(slug: string): Promise<TripWithDetails | null> {
  if (!isSupabaseConfigured()) {
    const trip = mockGetTripWithDetails(slug);
    if (!trip) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { salePrice: _salePrice, commissionRate: _commissionRate, ...publicTrip } = trip;
    return publicTrip as TripWithDetails;
  }
  const supabase = await createServerSupabase();
  const { data: tripRow, error } = await supabase
    .from("trips")
    .select(
      "id, client_id, title, slug, start_date, end_date, cover_image_url, instructions, status, created_at"
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!tripRow) return null;
  return assembleTripWithDetails(tripRow);
}

export type ClientTripHistory = {
  client: Pick<Client, "name" | "slug">;
  trips: Trip[];
};

// Vista pública /c/{clientSlug} (issue #47): nombre del cliente + sus viajes
// publicados. Usa trips.client_id (espejo de compatibilidad, ver
// setTripClients/0006_trip_clients.sql) en vez de trip_clients, porque
// trip_clients no tiene ninguna política de lectura pública (por diseño) y
// la RLS de "clients_public_read_published_trips" (0008 migration) se apoya
// en trips.client_id, ya legible por anon vía trips_public_read_published.
// Limitación conocida: en un viaje con 2+ clientes asignados, solo aparece
// bajo el slug del primer cliente (client_id espejo), no de todos.
export async function getClientPublishedTripsBySlug(
  clientSlug: string
): Promise<ClientTripHistory | null> {
  if (!isSupabaseConfigured()) {
    const client = mockClients.find((c) => c.slug === clientSlug);
    if (!client) return null;
    const trips = mockTrips
      .filter((t) => t.clientId === client.id && t.status === "published")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { client: { name: client.name, slug: client.slug }, trips };
  }
  const supabase = await createServerSupabase();
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("id, slug, name")
    .eq("slug", clientSlug)
    .maybeSingle();
  if (clientError) throw clientError;
  if (!clientRow) return null;

  const { data: tripRows, error: tripsError } = await supabase
    .from("trips")
    .select("*")
    .eq("client_id", clientRow.id as string)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (tripsError) throw tripsError;

  return {
    client: { name: clientRow.name as string, slug: clientRow.slug as string },
    trips: (tripRows ?? []).map(rowToTrip),
  };
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

  // Batch-resolve supplier name + address per itemId (issue #114)
  const supplierIds = [
    ...new Set(itemRows.map((i) => i.supplier_id as string).filter(Boolean)),
  ];
  let supplierById = new Map<string, Pick<Supplier, "name" | "address" | "lat" | "lng">>();
  if (supplierIds.length) {
    const { data: supplierRows, error: suppError } = await supabase
      .from("suppliers")
      .select("id, name, address, lat, lng")
      .in("id", supplierIds);
    if (suppError) throw suppError;
    supplierById = new Map(
      (supplierRows ?? []).map((r) => [
        r.id as string,
        {
          name: r.name as string,
          address: (r.address as string) ?? undefined,
          lat: r.lat !== null && r.lat !== undefined ? Number(r.lat) : undefined,
          lng: r.lng !== null && r.lng !== undefined ? Number(r.lng) : undefined,
        },
      ])
    );
  }

  const days = (dayRows ?? []).map((d) => {
    const day = rowToTripDay(d);
    const items = itemRows
      .filter((i) => i.trip_day_id === day.id)
      .map((i) => {
        const item: ItemWithSupplier = rowToItem(i);
        item.documents = documentRows
          .filter((doc) => doc.item_id === item.id)
          .map(rowToDocument);
        if (item.supplierId && supplierById.has(item.supplierId)) {
          item.supplier = supplierById.get(item.supplierId);
        }
        return item;
      });
    return { ...day, items };
  });

  const statusHistory = await getTripStatusHistory(trip.id);

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
    statusHistory,
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
    const now = new Date().toISOString();
    const trip: Trip = {
      id: uid(),
      clientId: clientIds[0] ?? "",
      title: input.title,
      slug: input.slug,
      startDate: input.startDate ?? "",
      endDate: input.endDate ?? "",
      coverImageUrl: input.coverImageUrl,
      instructions: sanitizeNote(input.instructions),
      travelerCount: input.travelerCount ?? 1,
      status: "draft",
      currency: input.currency ?? "MXN",
      isTemplate,
      showCostsToClient: false,
      createdAt: now,
      updatedAt: now,
    };
    mockTrips.unshift(trip);
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
      instructions: sanitizeNote(input.instructions) || null,
      currency: input.currency ?? "MXN",
      traveler_count: input.travelerCount ?? 1,
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
    const previousStatus = trip.status;
    if (input.title !== undefined) trip.title = input.title;
    if (input.slug !== undefined) trip.slug = input.slug;
    if (input.startDate !== undefined) trip.startDate = input.startDate;
    if (input.endDate !== undefined) trip.endDate = input.endDate;
    if (input.coverImageUrl !== undefined) trip.coverImageUrl = input.coverImageUrl;
    if (input.instructions !== undefined) trip.instructions = input.instructions ? sanitizeNote(input.instructions) : undefined;
    if (input.travelerCount !== undefined) trip.travelerCount = input.travelerCount;
    if (input.budget !== undefined) trip.budget = input.budget ?? undefined;
    if (input.status !== undefined) trip.status = input.status;
    if (input.currency !== undefined) trip.currency = input.currency;
    if (input.showCostsToClient !== undefined) trip.showCostsToClient = input.showCostsToClient;
    if (input.salePrice !== undefined) trip.salePrice = input.salePrice ?? undefined;
    if (input.commissionRate !== undefined) trip.commissionRate = input.commissionRate ?? undefined;
    if (input.status !== undefined && input.status !== previousStatus) {
      mockTripStatusHistory.push({
        id: uid(),
        tripId: trip.id,
        fromStatus: previousStatus,
        toStatus: input.status,
        changedAt: new Date().toISOString(),
      });
    }
    trip.updatedAt = new Date().toISOString();
    return trip;
  }
  const supabase = await createServerSupabase();

  let previousStatus: Trip["status"] | undefined;
  if (input.status !== undefined) {
    const { data: currentRow, error: currentError } = await supabase
      .from("trips")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (currentError) throw currentError;
    previousStatus = currentRow?.status as Trip["status"] | undefined;
  }

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.endDate !== undefined) patch.end_date = input.endDate;
  if (input.coverImageUrl !== undefined) patch.cover_image_url = input.coverImageUrl;
  if (input.instructions !== undefined) patch.instructions = sanitizeNote(input.instructions);
  if (input.travelerCount !== undefined) patch.traveler_count = input.travelerCount;
  if (input.budget !== undefined) patch.budget = input.budget;
  if (input.status !== undefined) patch.status = input.status;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.showCostsToClient !== undefined) patch.show_costs_to_client = input.showCostsToClient;
  if (input.salePrice !== undefined) patch.sale_price = input.salePrice;
  if (input.commissionRate !== undefined) patch.commission_rate = input.commissionRate;
  const { data, error } = await supabase.from("trips").update(patch).eq("id", id).select().single();
  if (error) throw error;

  if (input.status !== undefined && input.status !== previousStatus) {
    const { error: historyError } = await supabase.from("trip_status_history").insert({
      trip_id: id,
      from_status: previousStatus ?? null,
      to_status: input.status,
    });
    if (historyError) throw historyError;
  }

  return rowToTrip(data);
}

// Notas privadas de agente (Tritones), NUNCA visibles en /t/[slug]. Se leen y
// escriben a propósito por fuera de getTripById/getTripWithDetails/rowToTrip:
// esa ruta compartida alimenta tanto el dashboard como la vista pública, así
// que internal_notes jamás se selecciona/mapea ahí. En Supabase se hace un
// SELECT de una sola columna (nunca select("*") junto al resto del trip); en
// mock se guarda en un mapa aparte de mockTrips (ver mock-data.ts).
export async function getTripInternalNotes(id: string): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return mockTripInternalNotes[id] ?? null;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("trips")
    .select("internal_notes")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data?.internal_notes as string | null) ?? null;
}

export async function updateTripInternalNotes(id: string, internalNotes: string | null): Promise<void> {
  if (!isSupabaseConfigured()) {
    if (!mockTrips.some((t) => t.id === id)) throw new Error("Trip no encontrado");
    if (internalNotes) {
      mockTripInternalNotes[id] = internalNotes;
    } else {
      delete mockTripInternalNotes[id];
    }
    return;
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("trips")
    .update({ internal_notes: sanitizeNote(internalNotes) })
    .eq("id", id);
  if (error) throw error;
}

export async function getTripStatusHistory(tripId: string): Promise<TripStatusHistoryEntry[]> {
  if (!isSupabaseConfigured()) {
    return mockTripStatusHistory
      .filter((h) => h.tripId === tripId)
      .sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("trip_status_history")
    .select("*")
    .eq("trip_id", tripId)
    .order("changed_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToTripStatusHistory);
}

function rowToTripStatusHistory(row: Record<string, unknown>): TripStatusHistoryEntry {
  return {
    id: row.id as string,
    tripId: row.trip_id as string,
    fromStatus: (row.from_status as Trip["status"] | null) ?? null,
    toStatus: row.to_status as Trip["status"],
    changedAt: row.changed_at as string,
  };
}

export type MonthlyTripCount = { label: string; count: number };

// Agrupa trips por mes de creación para los últimos 6 meses (incluyendo el
// mes actual), rellenando con 0 los meses sin viajes creados. El agrupado se
// hace en JS (no SQL) para funcionar igual en modo mock y en modo Supabase,
// reutilizando getTrips() en vez de una query nueva.
export async function getTripsPerMonth(): Promise<MonthlyTripCount[]> {
  const { items: trips } = await getTrips({ pageSize: ALL_TRIPS_PAGE_SIZE });

  const now = new Date();
  const months: { year: number; month: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  const counts = months.map(() => 0);
  for (const trip of trips) {
    const created = new Date(trip.createdAt);
    const idx = months.findIndex(
      (m) => m.year === created.getFullYear() && m.month === created.getMonth()
    );
    if (idx !== -1) counts[idx]++;
  }

  return months.map((m, idx) => ({
    label: new Date(m.year, m.month, 1).toLocaleDateString("es-MX", {
      month: "short",
      year: "numeric",
    }),
    count: counts[idx],
  }));
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
    travelerCount: (row.traveler_count as number) ?? 1,
    budget: row.budget !== null && row.budget !== undefined ? Number(row.budget) : undefined,
    status: row.status as Trip["status"],
    currency: (row.currency as Trip["currency"]) ?? "MXN",
    isTemplate: Boolean(row.is_template),
    showCostsToClient: Boolean(row.show_costs_to_client),
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? (row.created_at as string),
    reminderSentAt: (row.reminder_sent_at as string) ?? undefined,
    salePrice:
      row.sale_price !== null && row.sale_price !== undefined ? Number(row.sale_price) : undefined,
    commissionRate:
      row.commission_rate !== null && row.commission_rate !== undefined
        ? Number(row.commission_rate)
        : undefined,
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

// ---------- Recordatorios automáticos por email (issue #49) ----------

export type TripReminderCandidate = Trip & { client: Client };

// Viajes publicados que empiezan entre hoy y hoy+daysAhead, sin recordatorio
// enviado todavía. Devuelve el cliente principal (primer asignado por
// created_at asc, igual que assembleTripWithDetails) porque el email se
// manda a un único destinatario.
export async function getTripsPendingReminder(daysAhead: number): Promise<TripReminderCandidate[]> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setUTCDate(cutoff.getUTCDate() + daysAhead);
  const todayStr = today.toISOString().slice(0, 10);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  if (!isSupabaseConfigured()) {
    return mockTrips
      .filter(
        (t) =>
          t.status === "published" &&
          !t.reminderSentAt &&
          t.startDate >= todayStr &&
          t.startDate <= cutoffStr
      )
      .map((trip) => {
        const link = mockTripClients
          .filter((tc) => tc.tripId === trip.id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
        const client = link ? mockClients.find((c) => c.id === link.clientId) : undefined;
        return client ? { ...trip, client } : null;
      })
      .filter((t): t is TripReminderCandidate => Boolean(t));
  }

  const supabase = await createServerSupabase();
  const { data: tripRows, error } = await supabase
    .from("trips")
    .select("*")
    .eq("status", "published")
    .is("reminder_sent_at", null)
    .gte("start_date", todayStr)
    .lte("start_date", cutoffStr);
  if (error) throw error;

  const trips = (tripRows ?? []).map(rowToTrip);
  if (!trips.length) return [];

  const tripIds = trips.map((t) => t.id);
  const { data: linkRows, error: linksError } = await supabase
    .from("trip_clients")
    .select("trip_id, client_id, created_at")
    .in("trip_id", tripIds)
    .order("created_at", { ascending: true });
  if (linksError) throw linksError;

  const primaryClientIdByTrip = new Map<string, string>();
  (linkRows ?? []).forEach((l) => {
    const tripId = l.trip_id as string;
    if (!primaryClientIdByTrip.has(tripId)) primaryClientIdByTrip.set(tripId, l.client_id as string);
  });

  const clientIds = [...new Set(primaryClientIdByTrip.values())];
  let clientsById = new Map<string, Client>();
  if (clientIds.length) {
    const { data: clientRows, error: clientsError } = await supabase
      .from("clients")
      .select("*")
      .in("id", clientIds);
    if (clientsError) throw clientsError;
    clientsById = new Map((clientRows ?? []).map((c) => [c.id as string, rowToClient(c)]));
  }

  return trips
    .map((trip) => {
      const clientId = primaryClientIdByTrip.get(trip.id);
      const client = clientId ? clientsById.get(clientId) : undefined;
      return client ? { ...trip, client } : null;
    })
    .filter((t): t is TripReminderCandidate => Boolean(t));
}

export async function markTripReminderSent(tripId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const trip = mockTrips.find((t) => t.id === tripId);
    if (trip) trip.reminderSentAt = new Date().toISOString();
    return;
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("trips")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", tripId);
  if (error) throw error;
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
      notes: sanitizeNote(input.notes),
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
      notes: sanitizeNote(input.notes),
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
    if (input.notes !== undefined) day.notes = sanitizeNote(input.notes);
    if (input.sortOrder !== undefined) day.sortOrder = input.sortOrder;
    return day;
  }
  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = {};
  if (input.date !== undefined) patch.date = input.date;
  if (input.notes !== undefined) patch.notes = sanitizeNote(input.notes);
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

export type GenerateTripDaysResult = { created: number; totalDays: number };

// Recorre start_date..end_date del viaje día por día, crea los trip_days que
// falten (createTripDay ya resuelve mock/Supabase) y luego reescribe el
// sort_order de TODOS los días del viaje en orden cronológico, para que los
// días recién generados queden intercalados correctamente y no simplemente
// al final de la lista.
export async function generateTripDays(tripId: string): Promise<GenerateTripDaysResult> {
  const trip = await getTripById(tripId);
  if (!trip) throw new Error("Viaje no encontrado");
  if (!trip.startDate || !trip.endDate) {
    throw new Error("El viaje necesita fecha de inicio y fin para generar los días");
  }

  const dates = enumerateDates(trip.startDate, trip.endDate);
  if (dates.length === 0) {
    throw new Error("El rango de fechas del viaje no es válido");
  }

  const dayIdByDate = new Map(trip.days.map((d) => [d.date, d.id]));
  const missingDates = dates.filter((date) => !dayIdByDate.has(date));

  for (const date of missingDates) {
    const created = await createTripDay({ tripId, date });
    dayIdByDate.set(date, created.id);
  }

  const order = dates.map((date, index) => ({
    id: dayIdByDate.get(date) as string,
    sortOrder: index,
  }));
  await reorderTripDays(order);

  return { created: missingDates.length, totalDays: dates.length };
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const dates: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
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
  supplierId?: string;
  metadata?: Record<string, unknown> | null;
};

export type UpdateItemInput = Partial<Omit<CreateItemInput, "tripDayId">>;

export async function createItem(input: CreateItemInput): Promise<Item> {
  if (!isSupabaseConfigured()) {
    const item = {
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
      supplierId: input.supplierId,
      metadata: (input.metadata ?? null) as unknown as Item["metadata"],
      sortOrder:
        input.sortOrder ?? mockItems.filter((i) => i.tripDayId === input.tripDayId).length,
    } as Item;
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
      notes: sanitizeNote(input.notes),
      cost: input.cost ?? null,
      supplier_id: input.supplierId || null,
      sort_order: input.sortOrder ?? 0,
      item_metadata: input.metadata ?? null,
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
    if (input.type !== undefined) item.type = input.type;
    if (input.title !== undefined) item.title = input.title;
    if (input.startTime !== undefined) item.startTime = input.startTime;
    if (input.endTime !== undefined) item.endTime = input.endTime;
    if (input.location !== undefined) item.location = input.location;
    if (input.lat !== undefined) item.lat = input.lat;
    if (input.lng !== undefined) item.lng = input.lng;
    if (input.confirmationCode !== undefined) item.confirmationCode = input.confirmationCode;
    if (input.notes !== undefined) item.notes = sanitizeNote(input.notes);
    if (input.cost !== undefined) item.cost = input.cost;
    if (input.supplierId !== undefined) item.supplierId = input.supplierId || undefined;
    if (input.sortOrder !== undefined) item.sortOrder = input.sortOrder;
    if (input.metadata !== undefined) item.metadata = (input.metadata ?? null) as unknown as Item["metadata"];
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

// Reasigna un item a otro día del mismo viaje (issue #132) sin borrarlo.
// Lo coloca al final del día destino (sort_order = max + 1) para no romper
// el orden relativo de los items ya existentes en ese día.
export async function moveItemToDay(itemId: string, targetDayId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const item = mockItems.find((i) => i.id === itemId);
    if (!item) return;
    item.tripDayId = targetDayId;
    const maxSort = mockItems
      .filter((i) => i.tripDayId === targetDayId && i.id !== itemId)
      .reduce((max, i) => Math.max(max, i.sortOrder), -1);
    item.sortOrder = maxSort + 1;
    return;
  }
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
  if (!isSupabaseConfigured()) {
    const found = mockItems.find((i) => i.id === id && !i.deletedAt);
    return found ? { ...found } : null;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("items")
    .select(
      "id, trip_day_id, type, title, start_time, end_time, location, lat, lng, confirmation_code, notes, cost, supplier_id, sort_order, item_metadata, deleted_at"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToItem(data) : null;
}

async function getNextItemSortOrder(tripDayId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    return mockItems.filter((i) => i.tripDayId === tripDayId && !i.deletedAt).length;
  }
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
    sortOrder: row.sort_order as number,
    metadata,
  } as Item;
}

// ---------- Documents ----------

const DOCUMENTS_BUCKET = "trip-documents";

export async function createDocument(input: {
  itemId: string;
  fileUrl: string;
  fileName: string;
  mimeType?: string;
}): Promise<ItemDocument> {
  if (!isSupabaseConfigured()) {
    return {
      id: uid(),
      itemId: input.itemId,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      mimeType: input.mimeType,
      uploadedAt: new Date().toISOString(),
    };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      item_id: input.itemId,
      file_url: input.fileUrl,
      file_name: input.fileName,
      mime_type: input.mimeType ?? null,
    })
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
  return createDocument({ itemId, fileUrl: path, fileName: file.name, mimeType: file.type || undefined });
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
    mimeType: (row.mime_type as string | null) ?? undefined,
    uploadedAt: row.uploaded_at as string,
  };
}

// ---------- Client documents (pasaporte/ID, no atados a un viaje) ----------
// Reutiliza el bucket privado "trip-documents" (ver 0002_storage_bucket.sql)
// bajo el prefijo "clients/{clientId}/...", registrados en la tabla
// client_documents (ver 0026_client_documents.sql). RLS restringe estas
// filas y este bucket al dueño autenticado únicamente: nunca se exponen en
// la vista pública /t/{slug}.

export async function uploadClientDocument(clientId: string, file: File): Promise<ClientDocument> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase no está configurado; no se pueden subir documentos.");
  }
  const supabase = await createServerSupabase();
  const path = `clients/${clientId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (uploadError) throw uploadError;
  const { data, error } = await supabase
    .from("client_documents")
    .insert({
      client_id: clientId,
      file_path: path,
      filename: file.name,
      mime_type: file.type || null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToClientDocument(data);
}

export async function getClientDocuments(
  clientId: string
): Promise<(ClientDocument & { url: string | null })[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("client_documents")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return Promise.all(
    (data ?? []).map(async (row) => {
      const doc = rowToClientDocument(row);
      const url = await getSignedDocumentUrl(doc.filePath);
      return { ...doc, url };
    })
  );
}

export async function deleteClientDocument(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await createServerSupabase();
  const { data: row } = await supabase
    .from("client_documents")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  if (row?.file_path) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([row.file_path as string]);
  }
  const { error } = await supabase.from("client_documents").delete().eq("id", id);
  if (error) throw error;
}

function rowToClientDocument(row: Record<string, unknown>): ClientDocument {
  return {
    id: row.id as string,
    clientId: row.client_id as string,
    filePath: row.file_path as string,
    filename: row.filename as string,
    mimeType: (row.mime_type as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

// ---------- Actividad reciente (dashboard) ----------

export type ActivityFeedItem = {
  id: string;
  entityType: "trip" | "client";
  action: "created" | "updated";
  title: string;
  href: string;
  timestamp: string;
};

// Feed combinado de los N eventos más recientes entre trips y clients,
// ordenado por updated_at desc. No hay un log de eventos separado: se
// clasifica cada fila como "updated" si updated_at se movió después de
// created_at (con margen de 1s para tolerar el redondeo del insert inicial),
// o "created" si no.
export async function getRecentActivity(limit = 8): Promise<ActivityFeedItem[]> {
  const [{ items: trips }, { items: clients }] = await Promise.all([
    getTrips({ pageSize: ALL_TRIPS_PAGE_SIZE }),
    getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE }),
  ]);

  const wasEdited = (createdAt: string, updatedAt: string) =>
    Date.parse(updatedAt) - Date.parse(createdAt) > 1000;

  const tripItems: ActivityFeedItem[] = trips.map((trip) => ({
    id: trip.id,
    entityType: "trip",
    action: wasEdited(trip.createdAt, trip.updatedAt) ? "updated" : "created",
    title: trip.title,
    href: `/dashboard/trips/${trip.id}`,
    timestamp: trip.updatedAt,
  }));

  const clientItems: ActivityFeedItem[] = clients.map((client) => ({
    id: client.id,
    entityType: "client",
    action: wasEdited(client.createdAt, client.updatedAt) ? "updated" : "created",
    title: client.name,
    href: `/dashboard/clients/${client.id}`,
    timestamp: client.updatedAt,
  }));

  return [...tripItems, ...clientItems]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
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

// ---------- Trip feedback (issue #46) ----------

export type CreateTripFeedbackInput = { tripId: string; rating: number; comment?: string };

// Insert público desde /t/{slug} (sin auth); RLS en trip_feedback (ver
// 0018_trip_feedback.sql) solo permite el insert si el trip referenciado
// está publicado, por lo que no se re-valida ese status aquí.
export async function createTripFeedback(input: CreateTripFeedbackInput): Promise<TripFeedback> {
  if (!isSupabaseConfigured()) {
    const feedback: TripFeedback = {
      id: uid(),
      tripId: input.tripId,
      rating: input.rating,
      comment: input.comment,
      createdAt: new Date().toISOString(),
    };
    mockTripFeedback.push(feedback);
    return feedback;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("trip_feedback")
    .insert({ trip_id: input.tripId, rating: input.rating, comment: input.comment })
    .select()
    .single();
  if (error) throw error;
  return rowToTripFeedback(data);
}

export async function getTripFeedback(tripId: string): Promise<TripFeedback[]> {
  if (!isSupabaseConfigured()) {
    return mockTripFeedback
      .filter((f) => f.tripId === tripId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("trip_feedback")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(rowToTripFeedback);
}

function rowToTripFeedback(row: Record<string, unknown>): TripFeedback {
  return {
    id: row.id as string,
    tripId: row.trip_id as string,
    rating: row.rating as number,
    comment: (row.comment as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}
