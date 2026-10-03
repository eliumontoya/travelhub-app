// ---------- Checklist de servicio ----------
//
// Extraído de src/lib/data/services.ts. services.ts lo reexporta para que la API
// pública de @/lib/data permanezca idéntica.

import {
  ServiceChecklistItem,
  ServiceChecklistItemWithUpload,
  ServiceUpload,
  ServiceWithChecklist,
} from "@/types";
import {
  mockServiceChecklistItems,
  mockServices,
  mockServiceUploads,
} from "@/lib/mock-data";
import { isSupabaseConfigured, uid } from "@/lib/data/shared";
import { DOCUMENTS_BUCKET, getSignedDocumentUrl } from "@/lib/data/documents";
import { rowToServiceUpload } from "@/lib/data/service-documents";
import { rowToService } from "@/lib/data/services";
import {
  DEFAULT_SERVICE_TYPE,
  getServiceClient,
  nowIso,
} from "@/lib/data/service-shared";

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
