import { Client, ClientHomeTrip, ItemWithSupplier, Supplier, Tag, Trip, TripFilters, TripWithDetails } from "@/types";
import { mockClients, mockItems, mockPackingItems, mockServiceChecklistItems, mockServices, mockTags, mockTravelAgents, mockTripClients, mockTripDays, mockTripFeedback, mockTripInternalNotes, mockTripPhotos, mockTripStatusHistory, mockTripTags, mockTrips, getTripWithDetails as mockGetTripWithDetails } from "@/lib/mock-data";
import { ALL_TRIPS_PAGE_SIZE, PaginationParams, PaginatedResult, canUseServiceRole, createServerSupabase, hasActiveTripFilters, isSupabaseConfigured, paginationBounds, sanitizeNote, tripMatchesFilters, uid } from "@/lib/data/shared";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { rowToClient, rowToTag } from "@/lib/data/clients";
import { DOCUMENTS_BUCKET, PHOTOS_BUCKET, getSignedDocumentUrl, rowToDocument, rowToTripDocument, rowToTripPhoto, storagePathFromPublicUrl } from "@/lib/data/documents";
import { deleteChecklistItem, ensureServiceForAssignment } from "@/lib/data/services";
import { rowToPackingItem } from "@/lib/data/trip-packing";
import { getTripStatusHistory } from "@/lib/data/trip-history";
import { rowToTripDay } from "@/lib/data/trip-days";
import { rowToItem } from "@/lib/data/trip-items";

export * from "@/lib/data/trip-packing";
export * from "@/lib/data/trip-reminders";
export * from "@/lib/data/trip-history";
export * from "@/lib/data/trip-days";
export * from "@/lib/data/trip-items";
export * from "@/lib/data/trip-templates";

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
  assignedAgentId?: string | null;
};

export type UpdateTripInput = Partial<{
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  coverImageUrl: string | null;
  instructions: string | null;
  travelerCount: number;
  budget: number | null;
  status: Trip["status"];
  currency: Trip["currency"];
  showCostsToClient: boolean;
  salePrice: number | null;
  commissionRate: number | null;
  assignedAgentId: string | null;
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
    if (input.assignedAgentId) {
      trip.assignedAgentId = input.assignedAgentId;
    }
    mockTrips.unshift(trip);
    clientIds.forEach((clientId, idx) => {
      mockTripClients.push({
        tripId: trip.id,
        clientId,
        createdAt: new Date(Date.parse(now) + idx).toISOString(),
      });
    });
    await Promise.all(
      clientIds.map((clientId) => ensureServiceForAssignment(trip.id, clientId))
    );
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
      assigned_agent_id: input.assignedAgentId ?? null,
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
    await Promise.all(
      clientIds.map((clientId) => ensureServiceForAssignment(trip.id, clientId))
    );
  }

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
    const toRemove = [...currentIds].filter((id) => !nextIds.has(id));
    const toAdd = clientIds.filter((id) => !currentIds.has(id));

    for (let i = mockTripClients.length - 1; i >= 0; i--) {
      const tc = mockTripClients[i];
      if (tc.tripId === tripId && !nextIds.has(tc.clientId)) {
        mockTripClients.splice(i, 1);
      }
    }
    for (const clientId of toRemove) {
      await deleteServiceForClient(tripId, clientId);
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
    await Promise.all(
      toAdd.map((clientId) => ensureServiceForAssignment(tripId, clientId))
    );

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
    for (const clientId of toRemove) {
      await deleteServiceForClient(tripId, clientId);
    }
  }

  if (toAdd.length) {
    const { error: addError } = await supabase
      .from("trip_clients")
      .upsert(
        toAdd.map((clientId) => ({ trip_id: tripId, client_id: clientId })),
        { onConflict: "trip_id,client_id", ignoreDuplicates: true }
      );
    if (addError) throw addError;
    await Promise.all(
      toAdd.map((clientId) => ensureServiceForAssignment(tripId, clientId))
    );
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
    if (input.coverImageUrl !== undefined) trip.coverImageUrl = input.coverImageUrl ?? undefined;
    if (input.instructions !== undefined) trip.instructions = input.instructions ? sanitizeNote(input.instructions) : undefined;
    if (input.travelerCount !== undefined) trip.travelerCount = input.travelerCount;
    if (input.budget !== undefined) trip.budget = input.budget ?? undefined;
    if (input.status !== undefined) trip.status = input.status;
    if (input.currency !== undefined) trip.currency = input.currency;
    if (input.showCostsToClient !== undefined) trip.showCostsToClient = input.showCostsToClient;
    if (input.salePrice !== undefined) trip.salePrice = input.salePrice ?? undefined;
    if (input.commissionRate !== undefined) trip.commissionRate = input.commissionRate ?? undefined;
    if (input.assignedAgentId !== undefined) {
      if (input.assignedAgentId) trip.assignedAgentId = input.assignedAgentId;
      else delete trip.assignedAgentId;
    }
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
  if (input.assignedAgentId !== undefined) patch.assigned_agent_id = input.assignedAgentId;
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

export async function deleteTrip(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const tripIndex = mockTrips.findIndex((t) => t.id === id);
    if (tripIndex < 0) throw new Error("Viaje no encontrado");

    const services = mockServices.filter((s) => s.tripId === id);
    for (const service of services) {
      const items = mockServiceChecklistItems.filter((i) => i.serviceId === service.id);
      for (const item of items) {
        await deleteChecklistItem(item.id);
      }
    }
    removeWhere(mockServices, (s) => s.tripId === id);

    const dayIds = new Set(mockTripDays.filter((d) => d.tripId === id).map((d) => d.id));
    const itemIds = new Set(mockItems.filter((i) => dayIds.has(i.tripDayId)).map((i) => i.id));

    mockTrips.splice(tripIndex, 1);
    removeWhere(mockTripDays, (day) => day.tripId === id);
    removeWhere(mockItems, (item) => itemIds.has(item.id));
    removeWhere(mockTripClients, (link) => link.tripId === id);
    removeWhere(mockTripTags, (link) => link.tripId === id);
    removeWhere(mockTripStatusHistory, (entry) => entry.tripId === id);
    removeWhere(mockTripFeedback, (entry) => entry.tripId === id);
    removeWhere(mockTripPhotos, (photo) => photo.tripId === id);
    removeWhere(mockPackingItems, (item) => item.tripId === id);
    delete mockTripInternalNotes[id];
    return;
  }

  const supabase = await createServerSupabase();
  const { data: tripRow, error: tripError } = await supabase
    .from("trips")
    .select("cover_image_url")
    .eq("id", id)
    .maybeSingle();
  if (tripError) throw tripError;
  if (!tripRow) throw new Error("Viaje no encontrado");

  const documentPaths: string[] = [];
  const photoPaths: string[] = [];
  const coverPath = storagePathFromPublicUrl(PHOTOS_BUCKET, (tripRow.cover_image_url as string | null) ?? "");
  if (coverPath) photoPaths.push(coverPath);

  const { data: tripDocs, error: tripDocsError } = await supabase
    .from("trip_documents")
    .select("file_path")
    .eq("trip_id", id);
  if (tripDocsError) throw tripDocsError;
  documentPaths.push(...(tripDocs ?? []).map((row) => row.file_path as string).filter(Boolean));

  const { data: photos, error: photosError } = await supabase
    .from("trip_photos")
    .select("file_path")
    .eq("trip_id", id);
  if (photosError) throw photosError;
  photoPaths.push(...(photos ?? []).map((row) => row.file_path as string).filter(Boolean));

  const { data: days, error: daysError } = await supabase
    .from("trip_days")
    .select("id")
    .eq("trip_id", id);
  if (daysError) throw daysError;
  const dayIds = (days ?? []).map((row) => row.id as string);
  if (dayIds.length) {
    const { data: items, error: itemsError } = await supabase
      .from("items")
      .select("id")
      .in("trip_day_id", dayIds);
    if (itemsError) throw itemsError;
    const itemIds = (items ?? []).map((row) => row.id as string);
    if (itemIds.length) {
      const { data: itemDocs, error: itemDocsError } = await supabase
        .from("documents")
        .select("file_url")
        .in("item_id", itemIds);
      if (itemDocsError) throw itemDocsError;
      documentPaths.push(...(itemDocs ?? []).map((row) => row.file_url as string).filter(Boolean));
    }
  }

  const { data: serviceRows, error: servicesError } = await supabase
    .from("services")
    .select("id")
    .eq("trip_id", id);
  if (servicesError) throw servicesError;
  const serviceIds = (serviceRows ?? []).map((row) => row.id as string);
  if (serviceIds.length) {
    const { data: serviceUploadRows, error: serviceUploadsError } = await supabase
      .from("service_uploads")
      .select("file_path")
      .in("service_id", serviceIds);
    if (serviceUploadsError) throw serviceUploadsError;
    documentPaths.push(
      ...(serviceUploadRows ?? [])
        .map((row) => row.file_path as string)
        .filter(Boolean)
    );
  }

  if (documentPaths.length) await supabase.storage.from(DOCUMENTS_BUCKET).remove(documentPaths);
  if (photoPaths.length) await supabase.storage.from(PHOTOS_BUCKET).remove(photoPaths);

  const { error } = await supabase.from("trips").delete().eq("id", id);
  if (error) throw error;
}

function removeWhere<T>(items: T[], predicate: (item: T) => boolean): void {
  for (let i = items.length - 1; i >= 0; i--) {
    if (predicate(items[i])) items.splice(i, 1);
  }
}

// Borra el servicio trip_documents de un cliente dentro de un viaje,
// eliminando primero sus checklist items (y con ello sus uploads + objetos
// de storage) para evitar huérfanos. Se usa en setTripClients (remoción) y
// deleteTrip (cascada).
async function deleteServiceForClient(tripId: string, clientId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const service = mockServices.find(
      (s) =>
        s.tripId === tripId &&
        s.clientId === clientId &&
        s.serviceType === "trip_documents"
    );
    if (!service) return;
    const items = mockServiceChecklistItems.filter((i) => i.serviceId === service.id);
    for (const item of items) {
      await deleteChecklistItem(item.id);
    }
    const idx = mockServices.findIndex((s) => s.id === service.id);
    if (idx >= 0) mockServices.splice(idx, 1);
    return;
  }

  const supabase = await createServerSupabase();
  const { data: serviceRows, error: serviceError } = await supabase
    .from("services")
    .select("id")
    .eq("trip_id", tripId)
    .eq("client_id", clientId)
    .eq("service_type", "trip_documents");
  if (serviceError) throw serviceError;

  for (const row of serviceRows ?? []) {
    const serviceId = row.id as string;
    const { data: itemRows, error: itemsError } = await supabase
      .from("service_checklist_items")
      .select("id")
      .eq("service_id", serviceId);
    if (itemsError) throw itemsError;
    for (const itemRow of itemRows ?? []) {
      await deleteChecklistItem(itemRow.id as string);
    }
    const { error: deleteServiceError } = await supabase
      .from("services")
      .delete()
      .eq("id", serviceId);
    if (deleteServiceError) throw deleteServiceError;
  }
}

export function rowToTrip(row: Record<string, unknown>): Trip {
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
    assignedAgentId:
      row.assigned_agent_id !== null && row.assigned_agent_id !== undefined
        ? (row.assigned_agent_id as string)
        : undefined,
    salePrice:
      row.sale_price !== null && row.sale_price !== undefined ? Number(row.sale_price) : undefined,
    commissionRate:
      row.commission_rate !== null && row.commission_rate !== undefined
        ? Number(row.commission_rate)
        : undefined,
  };
}
