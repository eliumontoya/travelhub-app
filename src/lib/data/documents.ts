import { ClientDocument, ItemDocument, TripDocument, TripPhoto } from "@/types";
import { mockClients, mockTripPhotos, mockTrips } from "@/lib/mock-data";
import { createServerSupabase, isSupabaseConfigured, sanitizeStorageKey, uid } from "@/lib/data/shared";
import { updateTrip } from "@/lib/data/trips";
import { updateClient } from "@/lib/data/clients";

// ---------- Documents ----------

export const DOCUMENTS_BUCKET = "trip-documents";

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
  const path = `${itemId}/${Date.now()}-${sanitizeStorageKey(file.name)}`;
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

export function rowToDocument(row: Record<string, unknown>): ItemDocument {
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
  const path = `clients/${clientId}/${Date.now()}-${sanitizeStorageKey(file.name)}`;
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

// ---------- Client cover image (issue #133) ----------
// La portada del perfil del cliente se sirve en /c/[slug] sin autenticación,
// por lo que vive en el bucket PÚBLICO "client-covers" (ver
// 0031_client_cover_image.sql). Se guarda solo la URL pública en
// clients.cover_image_url; no se registra fila adicional en ninguna tabla.

const COVERS_BUCKET = "client-covers";

export async function uploadClientCoverImage(
  clientId: string,
  file: File
): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase no está configurado; no se puede subir la portada.");
  }
  const supabase = await createServerSupabase();
  const path = `clients/${clientId}/${Date.now()}-${sanitizeStorageKey(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(COVERS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (uploadError) throw uploadError;
  const { data: publicUrlData } = supabase.storage.from(COVERS_BUCKET).getPublicUrl(path);
  await updateClient(clientId, { coverImageUrl: publicUrlData.publicUrl });
  return publicUrlData.publicUrl;
}

export async function removeClientCoverImage(clientId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const client = mockClients.find((c) => c.id === clientId);
    if (!client) throw new Error("Cliente no encontrado");
    client.coverImageUrl = undefined;
    client.updatedAt = new Date().toISOString();
    return;
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("clients")
    .update({ cover_image_url: null })
    .eq("id", clientId);
  if (error) throw error;
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

export function rowToClientDocument(row: Record<string, unknown>): ClientDocument {
  return {
    id: row.id as string,
    clientId: row.client_id as string,
    filePath: row.file_path as string,
    filename: row.filename as string,
    mimeType: (row.mime_type as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

// ---------- Global trip documents (no atados a un item específico) ----------
// Reutiliza el bucket privado "trip-documents" (ver 0002_storage_bucket.sql)
// bajo el prefijo "trips/{tripId}/...", registrados en la tabla
// trip_documents (ver 0031_trip_documents.sql). A diferencia de
// client_documents (ocultos en /t/{slug}), estos SÍ se exponen en la vista
// pública cuando el viaje está publicado, igual que documents (item-level).

export async function uploadTripDocument(tripId: string, file: File): Promise<TripDocument> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase no está configurado; no se pueden subir documentos.");
  }
  const supabase = await createServerSupabase();
  const path = `trips/${tripId}/${Date.now()}-${sanitizeStorageKey(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (uploadError) throw uploadError;
  const { data, error } = await supabase
    .from("trip_documents")
    .insert({
      trip_id: tripId,
      file_path: path,
      filename: file.name,
      mime_type: file.type || null,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToTripDocument(data);
}

export async function getTripDocuments(
  tripId: string
): Promise<(TripDocument & { url: string | null })[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("trip_documents")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return Promise.all(
    (data ?? []).map(async (row) => {
      const doc = rowToTripDocument(row);
      const url = await getSignedDocumentUrl(doc.filePath);
      return { ...doc, url };
    })
  );
}

export async function deleteTripDocument(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await createServerSupabase();
  const { data: row } = await supabase
    .from("trip_documents")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  if (row?.file_path) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([row.file_path as string]);
  }
  const { error } = await supabase.from("trip_documents").delete().eq("id", id);
  if (error) throw error;
}

export function rowToTripDocument(row: Record<string, unknown>): TripDocument {
  return {
    id: row.id as string,
    tripId: row.trip_id as string,
    filePath: row.file_path as string,
    filename: row.filename as string,
    mimeType: (row.mime_type as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

// ---------- Trip photos (galería pública) ----------

// Bucket público (a diferencia de "trip-documents", privado): las fotos
// están pensadas para verse en /t/{slug}, ver
// supabase/migrations/0012_trip_photos.sql.
export const PHOTOS_BUCKET = "trip-photos";

export function rowToTripPhoto(row: Record<string, unknown>): TripPhoto {
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
  const path = `${tripId}/${Date.now()}-${sanitizeStorageKey(file.name)}`;
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

// ---------- Trip cover image (issue #153) ----------
// La portada del viaje se sirve en /t/[slug] sin autenticación, por lo que
// reutiliza el bucket PÚBLICO "trip-photos" (ver 0012_trip_photos.sql) bajo
// el prefijo "covers/{tripId}/...". A diferencia del client-cover, al
// reemplazar/eliminar se borra el objeto anterior para evitar huérfanos.

export function storagePathFromPublicUrl(bucket: string, url: string): string | null {
  const marker = `/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i >= 0 ? url.slice(i + marker.length) : null;
}

async function removeTripCoverObjectIfExists(tripId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await createServerSupabase();
  const { data: row } = await supabase
    .from("trips")
    .select("cover_image_url")
    .eq("id", tripId)
    .maybeSingle();
  const currentUrl = row?.cover_image_url as string | null;
  if (!currentUrl) return;
  const path = storagePathFromPublicUrl(PHOTOS_BUCKET, currentUrl);
  if (!path) return;
  await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
}

export async function uploadTripCoverImage(tripId: string, file: File): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase no está configurado; no se puede subir la portada.");
  }
  await removeTripCoverObjectIfExists(tripId);
  const supabase = await createServerSupabase();
  const path = `covers/${tripId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (uploadError) throw uploadError;
  const { data: publicUrlData } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);
  await updateTrip(tripId, { coverImageUrl: publicUrlData.publicUrl });
  return publicUrlData.publicUrl;
}

export async function removeTripCoverImage(tripId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const trip = mockTrips.find((t) => t.id === tripId);
    if (!trip) throw new Error("Viaje no encontrado");
    trip.coverImageUrl = undefined;
    trip.updatedAt = new Date().toISOString();
    return;
  }
  await removeTripCoverObjectIfExists(tripId);
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("trips")
    .update({ cover_image_url: null })
    .eq("id", tripId);
  if (error) throw error;
}

const SITE_ASSETS_BUCKET = "site-assets";

export async function uploadSiteLogo(file: File): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase no está configurado; no se puede subir el logo.");
  }
  const supabase = await createServerSupabase();
  const path = `logo/${Date.now()}-${sanitizeStorageKey(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(SITE_ASSETS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

