import { Client, Tag } from "@/types";
import { mockClients, mockClientTags, mockTags, mockTripClients, mockTrips, mockTripTags } from "@/lib/mock-data";
import { ALL_CLIENTS_PAGE_SIZE, PaginationParams, PaginatedResult, createServerSupabase, effectiveWhatsapp, isSupabaseConfigured, paginationBounds, sanitizeNote, slugify, uid } from "@/lib/data/shared";

// ---------- Clients ----------

export type CreateClientInput = {
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  notes?: string;
  referralSource?: string;
  birthDate?: string;
  coverImageUrl?: string;
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
      whatsapp: effectiveWhatsapp(input.whatsapp, input.phone),
      notes: sanitizeNote(input.notes),
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
      whatsapp: input.whatsapp,
      notes: sanitizeNote(input.notes),
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
    if (input.whatsapp !== undefined) client.whatsapp = effectiveWhatsapp(input.whatsapp, input.phone ?? client.phone);
    if (input.notes !== undefined) client.notes = sanitizeNote(input.notes);
    if (input.referralSource !== undefined) client.referralSource = input.referralSource || null;
    if (input.birthDate !== undefined) client.birthDate = input.birthDate;
    if (input.coverImageUrl !== undefined) client.coverImageUrl = input.coverImageUrl;
    client.updatedAt = new Date().toISOString();
    return client;
  }
  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.email !== undefined) patch.email = input.email;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.whatsapp !== undefined) patch.whatsapp = input.whatsapp;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.referralSource !== undefined) patch.referral_source = input.referralSource || null;
  if (input.birthDate !== undefined) patch.birth_date = input.birthDate || null;
  if (input.coverImageUrl !== undefined) patch.cover_image_url = input.coverImageUrl || null;
  const { data, error } = await supabase.from("clients").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return rowToClient(data);
}

export async function deleteClient(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const index = mockClients.findIndex((client) => client.id === id);
    if (index === -1) return;

    mockClients.splice(index, 1);

    for (let i = mockClientTags.length - 1; i >= 0; i--) {
      if (mockClientTags[i].clientId === id) mockClientTags.splice(i, 1);
    }

    for (let i = mockTripClients.length - 1; i >= 0; i--) {
      if (mockTripClients[i].clientId === id) mockTripClients.splice(i, 1);
    }

    for (const trip of mockTrips) {
      if (trip.clientId === id) trip.clientId = "";
    }
    return;
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

export function rowToClient(row: Record<string, unknown>): Client {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: (row.slug as string) ?? undefined,
    email: (row.email as string) ?? "",
    phone: (row.phone as string) ?? "",
    whatsapp: (row.whatsapp as string) ?? undefined,
    notes: (row.notes as string) ?? undefined,
    referralSource: (row.referral_source as string) ?? null,
    birthDate: (row.birth_date as string) ?? undefined,
    coverImageUrl: (row.cover_image_url as string) ?? undefined,
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

export function rowToTag(row: Record<string, unknown>): Tag {
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
