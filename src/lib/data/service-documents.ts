// ---------- Documentos de servicio (uploads) ----------
//
// Extraído de src/lib/data/services.ts. services.ts lo reexporta para que la API
// pública de @/lib/data permanezca idéntica.

import {
  ServiceDocumentSummary,
  ServiceUpload,
  ServiceUploadStatus,
} from "@/types";
import { sanitizeStorageKey } from "@/lib/data/shared";
import { DOCUMENTS_BUCKET } from "@/lib/data/documents";
import {
  DEFAULT_SERVICE_TYPE,
  getServiceClient,
  nowIso,
} from "@/lib/data/service-shared";

function buildStoragePath(
  serviceId: string,
  checklistItemId: string,
  fileName: string
): string {
  return `services/${serviceId}/${checklistItemId}/${Date.now()}-${sanitizeStorageKey(fileName)}`;
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

export async function getServiceDocumentSummariesForTrip(
  tripId: string
): Promise<ServiceDocumentSummary[]> {
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

export async function uploadServiceDocument(
  serviceId: string,
  checklistItemId: string,
  file: File
): Promise<ServiceUpload> {
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
