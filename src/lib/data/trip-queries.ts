// ---------- Agregados de lectura de viajes (issue #371) ----------
//
// Extraído de src/lib/data/trips.ts. trips.ts lo reexporta para que la API
// pública de @/lib/data permanezca idéntica.

import { Client, ClientHomeTrip, ItemWithSupplier, Supplier, Tag, Trip, TripFilters, TripWithDetails } from "@/types";
import { mockClients, mockTravelAgents, mockTripClients, mockTripInternalNotes, mockTripTags, mockTags, mockTrips, getTripWithDetails as mockGetTripWithDetails } from "@/lib/mock-data";
import { ALL_TRIPS_PAGE_SIZE, PaginationParams, PaginatedResult, canUseServiceRole, createServerSupabase, hasActiveTripFilters, isSupabaseConfigured, paginationBounds, tripMatchesFilters } from "@/lib/data/shared";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { rowToClient, rowToTag } from "@/lib/data/clients";
import { PHOTOS_BUCKET, getSignedDocumentUrl, rowToDocument, rowToTripDocument, rowToTripPhoto } from "@/lib/data/documents";
import { rowToPackingItem } from "@/lib/data/trip-packing";
import { getTripStatusHistory } from "@/lib/data/trip-history";
import { rowToTripDay } from "@/lib/data/trip-days";
import { rowToItem } from "@/lib/data/trip-items";
import { rowToTrip } from "@/lib/data/trips";

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

  if (filters.agentIds?.length) {
    const { data, error } = await supabase
      .from("trips")
      .select("id")
      .in("assigned_agent_id", filters.agentIds);
    if (error) throw error;
    matchingTripIds = intersectTripIds(
      matchingTripIds,
      new Set((data ?? []).map((row) => row.id as string)),
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

function toClientHomeTrip(trip: Trip): ClientHomeTrip {
  const agentName = trip.assignedAgentId
    ? mockTravelAgents.find((a) => a.id === trip.assignedAgentId)?.name
    : undefined;
  return {
    id: trip.id,
    title: trip.title,
    slug: trip.slug,
    startDate: trip.startDate,
    endDate: trip.endDate,
    coverImageUrl: trip.coverImageUrl,
    status: trip.status,
    currency: trip.currency,
    travelerCount: trip.travelerCount,
    salePrice: trip.salePrice,
    assignedAgentId: trip.assignedAgentId,
    assignedAgentName: agentName,
  };
}

function rowToClientHomeTrip(row: Record<string, unknown>, agentsById: Map<string, string>): ClientHomeTrip {
  const assignedAgentId =
    row.assigned_agent_id !== null && row.assigned_agent_id !== undefined
      ? (row.assigned_agent_id as string)
      : undefined;
  return {
    id: row.id as string,
    title: row.title as string,
    slug: row.slug as string,
    startDate: (row.start_date as string) ?? "",
    endDate: (row.end_date as string) ?? "",
    coverImageUrl: (row.cover_image_url as string) ?? undefined,
    status: row.status as Trip["status"],
    currency: (row.currency as Trip["currency"]) ?? "MXN",
    travelerCount: (row.traveler_count as number) ?? 1,
    salePrice:
      row.sale_price !== null && row.sale_price !== undefined ? Number(row.sale_price) : undefined,
    assignedAgentId,
    assignedAgentName: assignedAgentId ? agentsById.get(assignedAgentId) : undefined,
  };
}

// Viajes visibles para el cliente en su home (issue #307). Se leen vía
// trip_clients (fuente de verdad), se filtran draft|published, se ocultan
// archived, y se resuelven nombres de agentes en batch. Modo Supabase usa
// service role; si falta la service key se degrada a [] sin lanzar.
export async function getClientHomeTrips(clientId: string): Promise<ClientHomeTrip[]> {
  if (!isSupabaseConfigured()) {
    const tripIds = new Set(
      mockTripClients.filter((tc) => tc.clientId === clientId).map((tc) => tc.tripId)
    );
    return mockTrips
      .filter((t) => tripIds.has(t.id) && (t.status === "draft" || t.status === "published"))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toClientHomeTrip);
  }
  if (!canUseServiceRole()) return [];
  const supabase = getSupabaseAdmin();

  const { data: linkRows, error: linksError } = await supabase
    .from("trip_clients")
    .select("trip_id")
    .eq("client_id", clientId);
  if (linksError) throw linksError;

  const tripIds = (linkRows ?? []).map((l: Record<string, unknown>) => l.trip_id as string);
  if (!tripIds.length) return [];

  const { data: tripRows, error: tripsError } = await supabase
    .from("trips")
    .select("*")
    .in("id", tripIds)
    .in("status", ["draft", "published"])
    .order("created_at", { ascending: false });
  if (tripsError) throw tripsError;

  const agentIds = [
    ...new Set(
      (tripRows ?? [])
        .map((r: Record<string, unknown>) => r.assigned_agent_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  let agentsById = new Map<string, string>();
  if (agentIds.length) {
    const { data: agentRows, error: agentsError } = await supabase
      .from("travel_agents")
      .select("id, name")
      .in("id", agentIds);
    if (agentsError) throw agentsError;
    agentsById = new Map(
      (agentRows ?? []).map((r: Record<string, unknown>) => [r.id as string, r.name as string])
    );
  }

  return (tripRows ?? []).map((row: Record<string, unknown>) => rowToClientHomeTrip(row, agentsById));
}

export type ClientTripHistory = {
  client: Pick<Client, "name" | "slug" | "coverImageUrl">;
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
    return { client: { name: client.name, slug: client.slug, coverImageUrl: client.coverImageUrl }, trips };
  }
  const supabase = await createServerSupabase();
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("id, slug, name, cover_image_url")
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
    client: {
      name: clientRow.name as string,
      slug: clientRow.slug as string,
      coverImageUrl: (clientRow.cover_image_url as string) ?? undefined,
    },
    trips: (tripRows ?? []).map(rowToTrip),
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
  return assemblePublicTripWithDetails(tripRow);
}

async function assemblePublicTripWithDetails(tripRow: Record<string, unknown>): Promise<TripWithDetails> {
  const supabase = await createServerSupabase();
  const trip = rowToTrip(tripRow);

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

  const days = await Promise.all((dayRows ?? []).map(async (d) => {
    const day = rowToTripDay(d);
    const items = await Promise.all(itemRows
      .filter((i) => i.trip_day_id === day.id)
      .map(async (i) => {
        const item: ItemWithSupplier = rowToItem(i);
        item.documents = await Promise.all(documentRows
          .filter((doc) => doc.item_id === item.id)
          .map(async (docRow) => {
            const doc = rowToDocument(docRow);
            const url = await getSignedDocumentUrl(doc.fileUrl);
            return { ...doc, url };
          }));
        if (item.supplierId && supplierById.has(item.supplierId)) {
          item.supplier = supplierById.get(item.supplierId);
        }
        return item;
      }));
    return { ...day, items };
  }));

  const { data: tripDocRows, error: tripDocsError } = await supabase
    .from("trip_documents")
    .select("*")
    .eq("trip_id", trip.id)
    .order("created_at", { ascending: false });
  if (tripDocsError) throw tripDocsError;
  const documents = await Promise.all(
    (tripDocRows ?? []).map(async (row) => {
      const doc = rowToTripDocument(row);
      const url = await getSignedDocumentUrl(doc.filePath);
      return { ...doc, url };
    })
  );

  const { data: packingRows, error: packingError } = await supabase
    .from("packing_items")
    .select("id, trip_id, label, checked, sort_order")
    .eq("trip_id", trip.id)
    .order("sort_order", { ascending: true });
  if (packingError) throw packingError;
  const packingItems = (packingRows ?? []).map(rowToPackingItem);

  return {
    ...trip,
    clients: [],
    client: {} as Client,
    tags: [],
    statusHistory: [],
    photos,
    documents,
    days,
    packingItems,
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

  const days = await Promise.all((dayRows ?? []).map(async (d) => {
    const day = rowToTripDay(d);
    const items = await Promise.all(itemRows
      .filter((i) => i.trip_day_id === day.id)
      .map(async (i) => {
        const item: ItemWithSupplier = rowToItem(i);
        item.documents = await Promise.all(documentRows
          .filter((doc) => doc.item_id === item.id)
          .map(async (docRow) => {
            const doc = rowToDocument(docRow);
            const url = await getSignedDocumentUrl(doc.fileUrl);
            return { ...doc, url };
          }));
        if (item.supplierId && supplierById.has(item.supplierId)) {
          item.supplier = supplierById.get(item.supplierId);
        }
        return item;
      }));
    return { ...day, items };
  }));

  const statusHistory = await getTripStatusHistory(trip.id);

  const { data: packingRows, error: packingError } = await supabase
    .from("packing_items")
    .select("*")
    .eq("trip_id", trip.id)
    .order("sort_order", { ascending: true });
  if (packingError) throw packingError;
  const packingItems = (packingRows ?? []).map(rowToPackingItem);

  const { data: tripDocRows, error: tripDocsError } = await supabase
    .from("trip_documents")
    .select("*")
    .eq("trip_id", trip.id)
    .order("created_at", { ascending: false });
  if (tripDocsError) throw tripDocsError;
  const documents = await Promise.all(
    (tripDocRows ?? []).map(async (row) => {
      const doc = rowToTripDocument(row);
      const url = await getSignedDocumentUrl(doc.filePath);
      return { ...doc, url };
    })
  );

  return {
    ...trip,
    clients,
    client,
    tags,
    statusHistory,
    photos,
    documents,
    days,
    packingItems,
  };
}
