import { VisaDocument } from "@/types";
import { createServerSupabase, sanitizeStorageKey, uid } from "@/lib/data/shared";

// Bucket privado para documentos de visa (servicio de visas), espejo del
// patrón `trip-documents`. Es creado por
// `supabase/migrations/20260930000000_visas.sql` con `public = false`. Nunca
// exponer URLs públicas — todos los reads/downloads deben pasar por un
// endpoint autenticado del servidor.
export const VISA_DOCUMENTS_BUCKET = "visa-documents";

function nowIso(): string {
  return new Date().toISOString();
}

function buildStoragePath(visaId: string, fileName: string): string {
  return `visas/${visaId}/${uid()}-${sanitizeStorageKey(fileName)}`;
}

export function rowToVisaDocument(row: Record<string, unknown>): VisaDocument {
  return {
    id: row.id as string,
    visaId: row.visa_id as string,
    targetClientId: (row.target_client_id as string | null) ?? null,
    description: (row.description as string) ?? undefined,
    filePath: (row.file_path as string | null) ?? null,
    filename: (row.filename as string) ?? undefined,
    mimeType: (row.mime_type as string) ?? undefined,
    status: row.status as VisaDocument["status"],
    agentComment: (row.agent_comment as string) ?? undefined,
    uploadedAt: (row.uploaded_at as string | null) ?? undefined,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at as string) ?? (row.created_at as string),
  };
}

async function ensureVisaExists(visaId: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("visas")
    .select("id")
    .eq("id", visaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Visa ${visaId} not found`);
}

export async function uploadVisaDocument(
  visaId: string,
  file: File
): Promise<VisaDocument> {
  await ensureVisaExists(visaId);
  const now = nowIso();

  const supabase = await createServerSupabase();
  const path = buildStoragePath(visaId, file.name);
  const { error: uploadError } = await supabase.storage
    .from(VISA_DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("visa_documents")
    .insert({
      visa_id: visaId,
      target_client_id: null,
      file_path: path,
      filename: file.name,
      mime_type: file.type || null,
      status: "uploaded",
      uploaded_at: now,
    })
    .select()
    .single();
  if (error) {
    // Best-effort cleanup of the orphan storage object — keeps the bucket tidy
    // if the row insert fails. We do not throw an AggregateError here because
    // there is no "previous path" to preserve; the only side effect is one
    // orphan object in a private bucket, which is recoverable.
    await supabase.storage.from(VISA_DOCUMENTS_BUCKET).remove([path]);
    throw error;
  }
  return rowToVisaDocument(data);
}

export async function requestVisaDocument(
  visaId: string,
  clientId: string,
  description: string
): Promise<VisaDocument> {
  await ensureVisaExists(visaId);

  // Validar que el cliente está asignado al visa. La presencia de
  // `target_client_id` no implica asignación — debe coincidir con una fila
  // real en `visa_clients`.
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("visa_clients")
    .select("client_id")
    .eq("visa_id", visaId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(`Client ${clientId} is not assigned to visa ${visaId}`);
  }

  const trimmedDescription = description.trim();
  if (!trimmedDescription) {
    throw new Error("Document description is required");
  }

  const { data: insertData, error: insertError } = await supabase
    .from("visa_documents")
    .insert({
      visa_id: visaId,
      target_client_id: clientId,
      description: trimmedDescription,
      file_path: null,
      status: "requested",
    })
    .select()
    .single();
  if (insertError) throw insertError;
  return rowToVisaDocument(insertData);
}

export async function getVisaDocuments(
  visaId: string
): Promise<(VisaDocument & { url: string | null })[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("visa_documents")
    .select("*")
    .eq("visa_id", visaId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return Promise.all(
    (data ?? []).map(async (row) => {
      const doc = rowToVisaDocument(row);
      const url = doc.filePath
        ? await getSignedVisaDocumentUrl(doc.filePath)
        : null;
      return { ...doc, url };
    })
  );
}

// Genera una URL firmada de corta duración para descargar/ver un documento de
// visa privado. Devuelve null si el firmado falla.
// Nunca retorna una URL pública — el bucket es privado por diseño
// (servicio-de-visas / `20260930000000_visas.sql`).
export async function getSignedVisaDocumentUrl(
  path: string
): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.storage
    .from(VISA_DOCUMENTS_BUCKET)
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

/**
 * Helper que aplica la lógica común de los flujos de transición de estado
 * sobre los documentos de visa. La función sólo muta el estado cuando el estado
 * actual es uno de los `allowedStatuses` esperados y lanza un error descriptivo
 * en caso contrario.
 */
async function transitionVisaDocument(
  id: string,
  allowedStatuses: VisaDocument["status"][],
  patch: Partial<{
    status: VisaDocument["status"];
    agentComment: string;
    filePath: string | null;
    filename: string;
    mimeType: string;
    uploadedAt: string;
  }>
): Promise<VisaDocument> {
  const supabase = await createServerSupabase();
  // Verify current status before applying the transition (optimistic check;
  // the UPDATE also asserts via WHERE).
  const { data: currentRow, error: currentError } = await supabase
    .from("visa_documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (currentError) throw currentError;
  if (!currentRow) throw new Error(`Visa document ${id} not found`);
  const currentStatus = currentRow.status as VisaDocument["status"];
  if (!allowedStatuses.includes(currentStatus)) {
    throw new Error(
      `Cannot transition visa document ${id}: current status "${currentStatus}" not in [${allowedStatuses.join(", ")}]`
    );
  }

  const dbPatch: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.agentComment !== undefined) dbPatch.agent_comment = patch.agentComment;
  if (patch.filePath !== undefined) dbPatch.file_path = patch.filePath;
  if (patch.filename !== undefined) dbPatch.filename = patch.filename;
  if (patch.mimeType !== undefined) dbPatch.mime_type = patch.mimeType;
  if (patch.uploadedAt !== undefined) dbPatch.uploaded_at = patch.uploadedAt;

  const { data, error } = await supabase
    .from("visa_documents")
    .update(dbPatch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToVisaDocument(data);
}

export async function uploadVisaDocumentForRequest(
  documentId: string,
  clientId: string,
  file: File
): Promise<VisaDocument> {
  const supabase = await createServerSupabase();
  const { data: docRow, error: docError } = await supabase
    .from("visa_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (docError) throw docError;
  const currentDoc: VisaDocument | undefined = docRow ? rowToVisaDocument(docRow) : undefined;
  if (!currentDoc) throw new Error(`Visa document ${documentId} not found`);
  if (currentDoc.targetClientId !== clientId) {
    throw new Error(
      `Client ${clientId} is not the assigned traveler for visa document ${documentId}`
    );
  }
  if (currentDoc.status !== "requested" && currentDoc.status !== "re_upload_requested") {
    throw new Error(
      `Visa document ${documentId} is not awaiting an upload (current status: "${currentDoc.status}")`
    );
  }

  const newPath = buildStoragePath(currentDoc.visaId, file.name);
  const now = nowIso();

  // 1) Subir el nuevo archivo.
  const { error: uploadError } = await supabase.storage
    .from(VISA_DOCUMENTS_BUCKET)
    .upload(newPath, file, { contentType: file.type || undefined });
  if (uploadError) throw uploadError;

  // 2) Actualizar la fila. Si falla, compensar: borrar el archivo recién
  //    subido. Si la limpieza también falla, lanzar AggregateError con
  //    ambos errores para que el caller pueda decidir (mismo patrón que
  //    uploadServiceDocument).
  const { error: updateError } = await supabase
    .from("visa_documents")
    .update({
      status: "uploaded",
      file_path: newPath,
      filename: file.name,
      mime_type: file.type || null,
      uploaded_at: now,
      updated_at: now,
    })
    .eq("id", documentId);
  if (updateError) {
    let cleanupFailure: unknown;
    try {
      const { error: removeError } = await supabase.storage
        .from(VISA_DOCUMENTS_BUCKET)
        .remove([newPath]);
      cleanupFailure = removeError;
    } catch (removeError) {
      cleanupFailure = removeError;
    }
    if (cleanupFailure) {
      throw new AggregateError(
        [updateError, cleanupFailure],
        `Persistence failed and cleanup is incomplete; ${newPath} may remain orphaned.`
      );
    }
    throw updateError;
  }

  // 3) Si había un archivo previo, eliminarlo (compensa el re-upload).
  if (currentDoc.filePath && currentDoc.filePath !== newPath) {
    await supabase.storage
      .from(VISA_DOCUMENTS_BUCKET)
      .remove([currentDoc.filePath]);
  }

  const { data, error } = await supabase
    .from("visa_documents")
    .select("*")
    .eq("id", documentId)
    .single();
  if (error) throw error;
  return rowToVisaDocument(data);
}

/**
 * Verifica que un documento de visa pertenece al visa esperado. Si la fila no
 * existe, o si pertenece a otro visa, lanza un error genérico
 * `"Visa document {id} not found"` — esto evita que un caller pueda sondear
 * qué visa es dueña de qué documento. Misma semántica que
 * `assertServiceUploadMutable` pero sin la verificación de archivado (los
 * visa no tienen estado archivado todavía, ver open questions en design.md).
 */
export async function assertVisaDocumentMutable(
  documentId: string,
  visaId: string
): Promise<void> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("visa_documents")
    .select("visa_id")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw error;
  if (!data || (data.visa_id as string) !== visaId) {
    throw new Error(`Visa document ${documentId} not found`);
  }
}

export async function markVisaDocumentReviewed(id: string): Promise<void> {
  await transitionVisaDocument(id, ["uploaded"], { status: "reviewed" });
}

export async function markVisaDocumentProcessed(id: string): Promise<void> {
  await transitionVisaDocument(id, ["reviewed"], { status: "processed" });
}

export async function requestVisaDocumentReUpload(
  id: string,
  comment: string
): Promise<void> {
  const trimmed = comment.trim();
  if (!trimmed) throw new Error("Agent comment is required");
  await transitionVisaDocument(id, ["uploaded"], {
    status: "re_upload_requested",
    agentComment: trimmed,
  });
}
