import {
  Service,
  ServiceChecklistItem,
  ServiceChecklistItemWithUpload,
  ServiceDocumentSummary,
  ServiceType,
  ServiceUpload,
  ServiceUploadStatus,
  ServiceWithChecklist,
} from "@/types";
import {
  mockServiceChecklistItems,
  mockServices,
  mockServiceUploads,
} from "@/lib/mock-data";
import {
  canUseServiceRole,
  createServerSupabase,
  isSupabaseConfigured,
  sanitizeStorageKey,
  uid,
} from "@/lib/data/shared";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { DOCUMENTS_BUCKET, getSignedDocumentUrl } from "@/lib/data/documents";
import { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SERVICE_TYPE: ServiceType = "trip_documents";

async function getServiceClient(): Promise<SupabaseClient> {
  if (canUseServiceRole()) return getSupabaseAdmin();
  if (isSupabaseConfigured()) return await createServerSupabase();
  throw new Error("Supabase no está configurado");
}

function nowIso() {
  return new Date().toISOString();
}

function buildStoragePath(
  serviceId: string,
  checklistItemId: string,
  fileName: string
): string {
  return `services/${serviceId}/${checklistItemId}/${Date.now()}-${sanitizeStorageKey(fileName)}`;
}

export function rowToService(row: Record<string, unknown>): Service {
  return {
    id: row.id as string,
    tripId: row.trip_id as string,
    clientId: row.client_id as string,
    serviceType: (row.service_type as ServiceType) ?? DEFAULT_SERVICE_TYPE,
    status: (row.status as Service["status"]) ?? "active",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function rowToServiceChecklistItem(
  row: Record<string, unknown>
): ServiceChecklistItem {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    label: row.label as string,
    required: (row.required as boolean) ?? true,
    sortOrder: (row.sort_order as number) ?? 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function rowToServiceUpload(row: Record<string, unknown>): ServiceUpload {
  return {
    id: row.id as string,
    serviceId: row.service_id as string,
    checklistItemId: row.checklist_item_id as string,
    filePath: row.file_path as string,
    filename: row.filename as string,
    mimeType: (row.mime_type as string) ?? undefined,
    status: (row.status as ServiceUploadStatus) ?? "uploaded",
    agentComment: (row.agent_comment as string) ?? undefined,
    fileRemoved: (row.file_removed as boolean) ?? false,
    uploadedAt: row.uploaded_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Ownership + lifecycle guard for service-upload mutations performed through
 * a cookie-less surface (e.g. the MCP route).
 *
 * Verifies that the upload exists, belongs to the caller-supplied `tripId`
 * (via service→trip_id), and that the trip is not archived. Has no mock
 * branch by design: the MCP route enforces a 503 when the service role is
 * unavailable, so this helper only runs against real Supabase.
 *
 * The cross-trip ownership mismatch is mapped to "Upload no encontrado" so
 * callers cannot probe which trip owns which upload.
 */
export async function assertServiceUploadMutable(
  uploadId: string,
  tripId: string
): Promise<void> {
  const supabase = await getServiceClient();

  const { data: uploadRow, error: uploadError } = await supabase
    .from("service_uploads")
    .select("service_id")
    .eq("id", uploadId)
    .maybeSingle();
  if (uploadError) throw uploadError;
  if (!uploadRow) throw new Error("Upload no encontrado");

  const { data: serviceRow, error: serviceError } = await supabase
    .from("services")
    .select("trip_id")
    .eq("id", uploadRow.service_id as string)
    .maybeSingle();
  if (serviceError) throw serviceError;
  if (!serviceRow) throw new Error("Servicio no encontrado");

  if ((serviceRow.trip_id as string) !== tripId) {
    throw new Error("Upload no encontrado");
  }

  const { data: tripRow, error: tripError } = await supabase
    .from("trips")
    .select("status")
    .eq("id", tripId)
    .maybeSingle();
  if (tripError) throw tripError;
  if (tripRow?.status === "archived") {
    throw new Error("El viaje archivado es de solo lectura");
  }
}

export async function ensureServiceForAssignment(
  tripId: string,
  clientId: string
): Promise<Service> {
  if (!isSupabaseConfigured()) {
    const existing = mockServices.find(
      (s) =>
        s.tripId === tripId &&
        s.clientId === clientId &&
        s.serviceType === DEFAULT_SERVICE_TYPE
    );
    if (existing) return existing;
    const service: Service = {
      id: uid(),
      tripId,
      clientId,
      serviceType: DEFAULT_SERVICE_TYPE,
      status: "active",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    mockServices.push(service);
    return service;
  }

  const supabase = await getServiceClient();
  const { data, error } = await supabase
    .from("services")
    .upsert(
      {
        trip_id: tripId,
        client_id: clientId,
        service_type: DEFAULT_SERVICE_TYPE,
        status: "active",
      },
      { onConflict: "trip_id,client_id,service_type" }
    )
    .select()
    .single();
  if (error) throw error;
  return rowToService(data);
}

export async function getServiceForClientTrip(
  clientId: string,
  tripId: string
): Promise<Service | null> {
  if (!isSupabaseConfigured()) {
    return (
      mockServices.find(
        (s) =>
          s.clientId === clientId &&
          s.tripId === tripId &&
          s.serviceType === DEFAULT_SERVICE_TYPE
      ) ?? null
    );
  }

  const supabase = await getServiceClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("client_id", clientId)
    .eq("trip_id", tripId)
    .eq("service_type", DEFAULT_SERVICE_TYPE)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToService(data) : null;
}

export async function getServicesForTrip(tripId: string): Promise<Service[]> {
  if (!isSupabaseConfigured()) {
    return mockServices
      .filter((s) => s.tripId === tripId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const supabase = await getServiceClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToService);
}

export async function getServiceDocumentSummariesForTrip(
  tripId: string
): Promise<ServiceDocumentSummary[]> {
  if (!isSupabaseConfigured()) {
    return mockServices
      .filter(
        (service) =>
          service.tripId === tripId && service.serviceType === DEFAULT_SERVICE_TYPE
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((service) => {
        const items = mockServiceChecklistItems.filter(
          (item) => item.serviceId === service.id
        );
        const uploads = mockServiceUploads.filter(
          (upload) => upload.serviceId === service.id
        );
        return {
          serviceId: service.id,
          clientId: service.clientId,
          processed: uploads.filter((upload) => upload.status === "reviewed" || upload.status === "processed").length,
          total: items.length,
          awaitingReview: uploads.filter((upload) => upload.status === "uploaded").length,
        };
      });
  }

  const supabase = await getServiceClient();
  const { data: serviceRows, error: servicesError } = await supabase
    .from("services")
    .select("id, client_id")
    .eq("trip_id", tripId)
    .eq("service_type", DEFAULT_SERVICE_TYPE)
    .order("created_at", { ascending: true });
  if (servicesError) throw servicesError;

  const services = serviceRows ?? [];
  const serviceIds = services.map((service) => service.id as string);
  if (serviceIds.length === 0) return [];

  const [{ data: itemRows, error: itemsError }, { data: uploadRows, error: uploadsError }] =
    await Promise.all([
      supabase.from("service_checklist_items").select("service_id").in("service_id", serviceIds),
      supabase.from("service_uploads").select("service_id, status").in("service_id", serviceIds),
    ]);
  if (itemsError) throw itemsError;
  if (uploadsError) throw uploadsError;

  const totals = new Map<string, number>();
  const processed = new Map<string, number>();
  const awaitingReview = new Map<string, number>();
  for (const item of itemRows ?? []) {
    const serviceId = item.service_id as string;
    totals.set(serviceId, (totals.get(serviceId) ?? 0) + 1);
  }
  for (const upload of uploadRows ?? []) {
    const serviceId = upload.service_id as string;
    if (upload.status === "reviewed" || upload.status === "processed") {
      processed.set(serviceId, (processed.get(serviceId) ?? 0) + 1);
    }
    if (upload.status === "uploaded") {
      awaitingReview.set(serviceId, (awaitingReview.get(serviceId) ?? 0) + 1);
    }
  }

  return services.map((service) => {
    const serviceId = service.id as string;
    return {
      serviceId,
      clientId: service.client_id as string,
      processed: processed.get(serviceId) ?? 0,
      total: totals.get(serviceId) ?? 0,
      awaitingReview: awaitingReview.get(serviceId) ?? 0,
    };
  });
}

export async function hasOwnedServiceRequirements(
  tripId: string,
  clientId: string
): Promise<boolean> {
  const service = await getServiceForClientTrip(clientId, tripId);
  if (!service) return false;

  if (!isSupabaseConfigured()) {
    return mockServiceChecklistItems.some((item) => item.serviceId === service.id);
  }

  const supabase = await getServiceClient();
  const { data, error } = await supabase
    .from("service_checklist_items")
    .select("id")
    .eq("service_id", service.id)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function nextSortOrder(serviceId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    const items = mockServiceChecklistItems.filter(
      (i) => i.serviceId === serviceId
    );
    return items.length === 0
      ? 0
      : Math.max(...items.map((i) => i.sortOrder)) + 1;
  }

  const supabase = await getServiceClient();
  const { data } = await supabase
    .from("service_checklist_items")
    .select("sort_order")
    .eq("service_id", serviceId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data?.sort_order as number | undefined) ?? -1) + 1;
}

export async function addChecklistItem(
  serviceId: string,
  input: { label: string; required?: boolean }
): Promise<ServiceChecklistItem> {
  const label = input.label.trim();
  if (!label) throw new Error("El label del checklist no puede estar vacío");
  const sortOrder = await nextSortOrder(serviceId);

  if (!isSupabaseConfigured()) {
    const item: ServiceChecklistItem = {
      id: uid(),
      serviceId,
      label,
      required: input.required ?? true,
      sortOrder,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    mockServiceChecklistItems.push(item);
    return item;
  }

  const supabase = await getServiceClient();
  const { data, error } = await supabase
    .from("service_checklist_items")
    .insert({
      service_id: serviceId,
      label,
      required: input.required ?? true,
      sort_order: sortOrder,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToServiceChecklistItem(data);
}

export async function addChecklistItemToTripServices(
  tripId: string,
  input: { label: string; required?: boolean }
): Promise<ServiceChecklistItem[]> {
  const label = input.label.trim();
  if (!label) throw new Error("El label del checklist no puede estar vacío");

  if (!isSupabaseConfigured()) {
    const services = mockServices.filter(
      (service) =>
        service.tripId === tripId && service.serviceType === DEFAULT_SERVICE_TYPE
    );
    if (services.length === 0) throw new Error("El viaje no tiene servicios disponibles");
    if (services.some((service) => service.status !== "active")) {
      throw new Error("No todos los servicios del viaje están disponibles");
    }

    const items = services.map((service) => {
      const existingItems = mockServiceChecklistItems.filter(
        (item) => item.serviceId === service.id
      );
      const sortOrder =
        existingItems.length === 0
          ? 0
          : Math.max(...existingItems.map((item) => item.sortOrder)) + 1;
      return {
        id: uid(),
        serviceId: service.id,
        label,
        required: input.required ?? true,
        sortOrder,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      } satisfies ServiceChecklistItem;
    });
    mockServiceChecklistItems.push(...items);
    return items;
  }

  const supabase = await getServiceClient();
  const { data: serviceRows, error: servicesError } = await supabase
    .from("services")
    .select("id, status")
    .eq("trip_id", tripId)
    .eq("service_type", DEFAULT_SERVICE_TYPE);
  if (servicesError) throw servicesError;
  const services = serviceRows ?? [];
  if (services.length === 0) throw new Error("El viaje no tiene servicios disponibles");
  if (services.some((service) => service.status !== "active")) {
    throw new Error("No todos los servicios del viaje están disponibles");
  }

  const serviceIds = services.map((service) => service.id as string);
  const { data: existingRows, error: existingError } = await supabase
    .from("service_checklist_items")
    .select("service_id, sort_order")
    .in("service_id", serviceIds);
  if (existingError) throw existingError;

  const nextOrders = new Map<string, number>();
  for (const row of existingRows ?? []) {
    const serviceId = row.service_id as string;
    nextOrders.set(serviceId, Math.max(nextOrders.get(serviceId) ?? 0, (row.sort_order as number) + 1));
  }
  const rows = services.map((service) => ({
    service_id: service.id as string,
    label,
    required: input.required ?? true,
    sort_order: nextOrders.get(service.id as string) ?? 0,
  }));
  const { data, error } = await supabase
    .from("service_checklist_items")
    .insert(rows)
    .select();
  if (error) throw error;
  return (data ?? []).map(rowToServiceChecklistItem);
}

export async function updateChecklistItem(
  id: string,
  input: { label?: string; required?: boolean }
): Promise<void> {
  if (!isSupabaseConfigured()) {
    const item = mockServiceChecklistItems.find((i) => i.id === id);
    if (!item) throw new Error("Checklist item no encontrado");
    if (input.label !== undefined) item.label = input.label.trim();
    if (input.required !== undefined) item.required = input.required;
    item.updatedAt = nowIso();
    return;
  }

  const supabase = await getServiceClient();
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.label !== undefined) update.label = input.label.trim();
  if (input.required !== undefined) update.required = input.required;
  const { error } = await supabase
    .from("service_checklist_items")
    .update(update)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteChecklistItem(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const item = mockServiceChecklistItems.find((i) => i.id === id);
    if (!item) return;
    mockServiceUploads.splice(
      0,
      mockServiceUploads.length,
      ...mockServiceUploads.filter((u) => u.checklistItemId !== id)
    );
    const idx = mockServiceChecklistItems.findIndex((i) => i.id === id);
    if (idx >= 0) mockServiceChecklistItems.splice(idx, 1);
    return;
  }

  const supabase = await getServiceClient();
  const { data: uploads } = await supabase
    .from("service_uploads")
    .select("file_path")
    .eq("checklist_item_id", id);
  const paths = (uploads ?? [])
    .map((u) => u.file_path as string)
    .filter(Boolean);
  if (paths.length > 0) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove(paths);
  }
  const { error: deleteUploadsError } = await supabase
    .from("service_uploads")
    .delete()
    .eq("checklist_item_id", id);
  if (deleteUploadsError) throw deleteUploadsError;
  const { error } = await supabase
    .from("service_checklist_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function reorderChecklistItems(
  serviceId: string,
  orderedIds: string[]
): Promise<void> {
  if (!isSupabaseConfigured()) {
    for (let i = 0; i < orderedIds.length; i++) {
      const item = mockServiceChecklistItems.find(
        (it) => it.id === orderedIds[i] && it.serviceId === serviceId
      );
      if (item) item.sortOrder = i;
    }
    return;
  }

  const supabase = await getServiceClient();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("service_checklist_items")
        .update({ sort_order: index, updated_at: nowIso() })
        .eq("id", id)
        .eq("service_id", serviceId)
    )
  );
}

export async function getServiceWithChecklist(
  serviceId: string
): Promise<ServiceWithChecklist> {
  if (!isSupabaseConfigured()) {
    const service = mockServices.find((s) => s.id === serviceId);
    if (!service) throw new Error("Servicio no encontrado");
    const items = mockServiceChecklistItems
      .filter((i) => i.serviceId === serviceId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => {
        const upload = mockServiceUploads.find(
          (u) => u.checklistItemId === item.id
        );
        const extended: ServiceChecklistItemWithUpload = { ...item };
        if (upload) {
          extended.upload = { ...upload, url: null };
        }
        return extended;
      });
    return { ...service, items };
  }

  const supabase = await getServiceClient();
  const { data: serviceRow, error: serviceError } = await supabase
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .single();
  if (serviceError) throw serviceError;

  const { data: itemRows, error: itemsError } = await supabase
    .from("service_checklist_items")
    .select("*")
    .eq("service_id", serviceId)
    .order("sort_order", { ascending: true });
  if (itemsError) throw itemsError;

  const { data: uploadRows, error: uploadsError } = await supabase
    .from("service_uploads")
    .select("*")
    .eq("service_id", serviceId);
  if (uploadsError) throw uploadsError;

  const uploadsByItemId = new Map<string, ServiceUpload>();
  for (const row of uploadRows ?? []) {
    const upload = rowToServiceUpload(row);
    uploadsByItemId.set(upload.checklistItemId, upload);
  }

  const items: ServiceChecklistItemWithUpload[] = await Promise.all(
    (itemRows ?? []).map(async (row) => {
      const item = rowToServiceChecklistItem(row);
      const upload = uploadsByItemId.get(item.id);
      if (!upload) return item;
      const url = await getSignedDocumentUrl(upload.filePath);
      return { ...item, upload: { ...upload, url } };
    })
  );

  return { ...rowToService(serviceRow), items };
}

export async function getServiceChecklistForTrip(
  tripId: string,
  serviceId: string
): Promise<ServiceWithChecklist> {
  if (!isSupabaseConfigured()) {
    const service = mockServices.find(
      (candidate) =>
        candidate.id === serviceId &&
        candidate.tripId === tripId &&
        candidate.serviceType === DEFAULT_SERVICE_TYPE
    );
    if (!service) throw new Error("El servicio no pertenece al viaje");
    return getServiceWithChecklist(service.id);
  }

  const supabase = await getServiceClient();
  const { data, error } = await supabase
    .from("services")
    .select("id")
    .eq("id", serviceId)
    .eq("trip_id", tripId)
    .eq("service_type", DEFAULT_SERVICE_TYPE)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("El servicio no pertenece al viaje");
  return getServiceWithChecklist(serviceId);
}

export async function uploadServiceDocument(
  serviceId: string,
  checklistItemId: string,
  file: File
): Promise<ServiceUpload> {
  if (!isSupabaseConfigured()) {
    const item = mockServiceChecklistItems.find(
      (i) => i.id === checklistItemId && i.serviceId === serviceId
    );
    if (!item) throw new Error("El item no pertenece al servicio");
    const existingIndex = mockServiceUploads.findIndex(
      (u) => u.serviceId === serviceId && u.checklistItemId === checklistItemId
    );
    if (existingIndex >= 0) mockServiceUploads.splice(existingIndex, 1);
    const upload: ServiceUpload = {
      id: uid(),
      serviceId,
      checklistItemId,
      filePath: buildStoragePath(serviceId, checklistItemId, file.name),
      filename: file.name,
      mimeType: file.type || undefined,
      status: "uploaded",
      fileRemoved: false,
      uploadedAt: nowIso(),
      updatedAt: nowIso(),
    };
    mockServiceUploads.push(upload);
    return upload;
  }

  const supabase = await getServiceClient();
  const { data: itemRow, error: itemError } = await supabase
    .from("service_checklist_items")
    .select("id, service_id")
    .eq("id", checklistItemId)
    .eq("service_id", serviceId)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!itemRow) throw new Error("El item no pertenece al servicio");

  const { data: existingUpload } = await supabase
    .from("service_uploads")
    .select("file_path")
    .eq("service_id", serviceId)
    .eq("checklist_item_id", checklistItemId)
    .maybeSingle();
  const oldPath = existingUpload?.file_path as string | undefined;

  const path = buildStoragePath(serviceId, checklistItemId, file.name);
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("service_uploads")
    .upsert(
      {
        service_id: serviceId,
        checklist_item_id: checklistItemId,
        file_path: path,
        filename: file.name,
        mime_type: file.type || null,
        status: "uploaded",
        agent_comment: null,
        file_removed: false,
      },
      { onConflict: "service_id,checklist_item_id" }
    )
    .select()
    .single();
  if (error) {
    let cleanupFailure: unknown;

    try {
      const { error: removeError } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
      cleanupFailure = removeError;
    } catch (removeError) {
      cleanupFailure = removeError;
    }

    if (cleanupFailure) {
      throw new AggregateError(
        [error, cleanupFailure],
        `Persistence failed and cleanup is incomplete; ${path} may remain orphaned.`
      );
    }

    throw error;
  }

  if (oldPath) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([oldPath]);
  }

  return rowToServiceUpload(data);
}

export async function markUploadReviewed(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const upload = mockServiceUploads.find((u) => u.id === id);
    if (!upload) throw new Error("Upload no encontrado");
    upload.status = "reviewed";
    upload.fileRemoved = false;
    upload.updatedAt = nowIso();
    return;
  }

  const supabase = await getServiceClient();
  const { error } = await supabase
    .from("service_uploads")
    .update({
      status: "reviewed",
      file_removed: false,
      updated_at: nowIso(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function markUploadProcessed(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const upload = mockServiceUploads.find((u) => u.id === id);
    if (!upload) throw new Error("Upload no encontrado");
    upload.status = "processed";
    upload.fileRemoved = true;
    upload.updatedAt = nowIso();
    return;
  }

  const supabase = await getServiceClient();
  const { data: upload } = await supabase
    .from("service_uploads")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  if (upload?.file_path) {
    const { error: removeError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .remove([upload.file_path as string]);
    if (removeError) throw removeError;
  }
  const { error } = await supabase
    .from("service_uploads")
    .update({
      status: "processed",
      file_removed: true,
      updated_at: nowIso(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function requestReUpload(
  id: string,
  comment: string
): Promise<void> {
  const trimmed = comment.trim();
  if (!trimmed) throw new Error("El comentario no puede estar vacío");

  if (!isSupabaseConfigured()) {
    const upload = mockServiceUploads.find((u) => u.id === id);
    if (!upload) throw new Error("Upload no encontrado");
    upload.status = "re_upload_requested";
    upload.agentComment = trimmed;
    upload.updatedAt = nowIso();
    return;
  }

  const supabase = await getServiceClient();
  const { error } = await supabase
    .from("service_uploads")
    .update({
      status: "re_upload_requested",
      agent_comment: trimmed,
      updated_at: nowIso(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function getServicesProgressForClient(
  clientId: string
): Promise<Map<string, { completed: number; total: number }>> {
  const result = new Map<string, { completed: number; total: number }>();

  if (!isSupabaseConfigured()) {
    const services = mockServices.filter(
      (s) => s.clientId === clientId && s.serviceType === DEFAULT_SERVICE_TYPE
    );
    for (const service of services) {
      const items = mockServiceChecklistItems.filter(
        (i) => i.serviceId === service.id
      );
      const completed = mockServiceUploads.filter(
        (u) =>
          u.serviceId === service.id &&
          (u.status === "reviewed" || u.status === "processed")
      ).length;
      result.set(service.id, { completed, total: items.length });
    }
    return result;
  }

  const supabase = await getServiceClient();
  const { data: serviceRows, error: servicesError } = await supabase
    .from("services")
    .select("id")
    .eq("client_id", clientId)
    .eq("service_type", DEFAULT_SERVICE_TYPE);
  if (servicesError) throw servicesError;
  const serviceIds = (serviceRows ?? []).map((r) => r.id as string);
  if (serviceIds.length === 0) return result;

  const { data: itemRows, error: itemsError } = await supabase
    .from("service_checklist_items")
    .select("service_id")
    .in("service_id", serviceIds);
  if (itemsError) throw itemsError;

  const { data: uploadRows, error: uploadsError } = await supabase
    .from("service_uploads")
    .select("service_id, status")
    .in("service_id", serviceIds)
    .in("status", ["reviewed", "processed"]);
  if (uploadsError) throw uploadsError;

  const totals = new Map<string, number>();
  for (const row of itemRows ?? []) {
    const sid = row.service_id as string;
    totals.set(sid, (totals.get(sid) ?? 0) + 1);
  }
  const completed = new Map<string, number>();
  for (const row of uploadRows ?? []) {
    const sid = row.service_id as string;
    completed.set(sid, (completed.get(sid) ?? 0) + 1);
  }

  for (const id of serviceIds) {
    result.set(id, {
      completed: completed.get(id) ?? 0,
      total: totals.get(id) ?? 0,
    });
  }
  return result;
}
