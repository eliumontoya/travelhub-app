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
