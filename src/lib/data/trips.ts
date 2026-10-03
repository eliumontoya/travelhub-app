import { Trip } from "@/types";
import { mockItems, mockPackingItems, mockServiceChecklistItems, mockServices, mockTripClients, mockTripDays, mockTripFeedback, mockTripInternalNotes, mockTripPhotos, mockTripStatusHistory, mockTripTags, mockTrips } from "@/lib/mock-data";
import { PaginationParams, PaginatedResult, createServerSupabase, isSupabaseConfigured, paginationBounds, sanitizeNote, uid } from "@/lib/data/shared";
import { DOCUMENTS_BUCKET, PHOTOS_BUCKET, storagePathFromPublicUrl } from "@/lib/data/documents";
import { deleteChecklistItem, ensureServiceForAssignment } from "@/lib/data/services";

export * from "@/lib/data/trip-packing";
export * from "@/lib/data/trip-reminders";
export * from "@/lib/data/trip-history";
export * from "@/lib/data/trip-days";
export * from "@/lib/data/trip-items";
export * from "@/lib/data/trip-templates";
export * from "@/lib/data/trip-queries";

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
