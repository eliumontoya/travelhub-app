"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createItem,
  createTrip,
  createPackingItem,
  createTripDay,
  deleteDocument,
  deleteItem,
  duplicateItem,
  deletePackingItem,
  deleteTrip,
  deleteTripDay,
  deleteTripPhoto,
  generateTripDays,
  getItemDocuments,
  getOrCreateTag,
  getTripById,
  reorderItems,
  reorderTripDays,
  restoreItem,
  restoreTripDay,
  saveTripAsTemplate,
  setTripClients,
  setTripTags,
  updateItem,
  updatePackingItem,
  updateTrip,
  updateTripDay,
  updateTripInternalNotes,
  uploadItemDocument,
  uploadTripDocument,
  getTripDocuments,
  deleteTripDocument,
  uploadTripPhoto,
  uploadTripCoverImage,
  removeTripCoverImage,
  moveItemToDay,
} from "@/lib/data";
import { ItemType, TripCurrency } from "@/types";
import { validateItemMetadata } from "@/lib/item-metadata-schemas";

const validCurrencies: TripCurrency[] = ["MXN", "USD", "EUR"];

function parseCoord(raw: FormDataEntryValue | null): number | undefined {
  const value = String(raw ?? "").trim();
  return value ? Number(value) : undefined;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseCost(raw: FormDataEntryValue | null): number | undefined {
  const value = String(raw ?? "").trim();
  return value ? Number(value) : undefined;
}

function revalidateTrip(tripId: string) {
  revalidatePath(`/dashboard/trips/${tripId}`);
}

function parseItemMetadata(type: ItemType, raw: FormDataEntryValue | null): Record<string, unknown> | null {
  if (!raw || !String(raw).trim()) return null;
  try {
    return validateItemMetadata(type, JSON.parse(String(raw)));
  } catch {
    throw new Error("Datos del item inválidos: revisa los campos específicos del tipo.");
  }
}

async function assertTripEditable(tripId: string) {
  const trip = await getTripById(tripId);
  if (!trip) throw new Error("Viaje no encontrado.");
  if (trip.status === "published") {
    throw new Error("El viaje publicado está bloqueado. Pásalo a borrador para editarlo.");
  }
}

export async function addDayAction(tripId: string, formData: FormData) {
  await assertTripEditable(tripId);
  const date = String(formData.get("date") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  if (!date) return;
  await createTripDay({ tripId, date, notes });
  revalidateTrip(tripId);
}

export async function generateTripDaysAction(
  tripId: string
): Promise<{ ok: boolean; message: string }> {
  try {
    await assertTripEditable(tripId);
    const result = await generateTripDays(tripId);
    revalidateTrip(tripId);
    if (result.created === 0) {
      return { ok: true, message: "No había días faltantes: ya existen todos los días del rango del viaje." };
    }
    return { ok: true, message: `Se generaron ${result.created} día(s) faltante(s).` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "No se pudieron generar los días.",
    };
  }
}

export async function editDayAction(tripId: string, dayId: string, formData: FormData) {
  await assertTripEditable(tripId);
  const date = String(formData.get("date") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  await updateTripDay(dayId, { date: date || undefined, notes });
  revalidateTrip(tripId);
}

export async function deleteDayAction(tripId: string, dayId: string) {
  await assertTripEditable(tripId);
  await deleteTripDay(dayId);
  revalidateTrip(tripId);
}

export async function restoreDayAction(tripId: string, dayId: string) {
  await assertTripEditable(tripId);
  await restoreTripDay(dayId);
  revalidateTrip(tripId);
}

export async function moveDayAction(
  tripId: string,
  days: { id: string; sortOrder: number }[],
  dayId: string,
  direction: "up" | "down"
) {
  await assertTripEditable(tripId);
  const sorted = [...days].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex((d) => d.id === dayId);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapWith < 0 || swapWith >= sorted.length) return;

  const a = sorted[idx];
  const b = sorted[swapWith];
  await reorderTripDays([
    { id: a.id, sortOrder: b.sortOrder },
    { id: b.id, sortOrder: a.sortOrder },
  ]);
  revalidateTrip(tripId);
}

export async function addItemAction(tripId: string, dayId: string, formData: FormData) {
  await assertTripEditable(tripId);
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const type = String(formData.get("type") ?? "note") as ItemType;
  const metadata = parseItemMetadata(type, formData.get("metadata"));
  await createItem({
    tripDayId: dayId,
    type,
    title,
    startTime: String(formData.get("startTime") ?? "").trim() || undefined,
    endTime: String(formData.get("endTime") ?? "").trim() || undefined,
    location: String(formData.get("location") ?? "").trim() || undefined,
    lat: parseCoord(formData.get("lat")),
    lng: parseCoord(formData.get("lng")),
    confirmationCode: String(formData.get("confirmationCode") ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim() || undefined,
    cost: parseCost(formData.get("cost")),
    metadata,
  });
  revalidateTrip(tripId);
}

export async function editItemAction(tripId: string, itemId: string, formData: FormData) {
  await assertTripEditable(tripId);
  const type = String(formData.get("type") ?? "note") as ItemType;
  const metadata = parseItemMetadata(type, formData.get("metadata"));
  await updateItem(itemId, {
    type,
    title: String(formData.get("title") ?? "").trim(),
    startTime: String(formData.get("startTime") ?? "").trim() || undefined,
    endTime: String(formData.get("endTime") ?? "").trim() || undefined,
    location: String(formData.get("location") ?? "").trim() || undefined,
    lat: parseCoord(formData.get("lat")),
    lng: parseCoord(formData.get("lng")),
    confirmationCode: String(formData.get("confirmationCode") ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim() || undefined,
    cost: parseCost(formData.get("cost")),
    metadata,
  });
  revalidateTrip(tripId);
}

export async function deleteItemAction(tripId: string, itemId: string) {
  await assertTripEditable(tripId);
  await deleteItem(itemId);
  revalidateTrip(tripId);
}

export async function restoreItemAction(tripId: string, itemId: string) {
  await assertTripEditable(tripId);
  await restoreItem(itemId);
  revalidateTrip(tripId);
}

export async function moveItemToDayAction(
  tripId: string,
  itemId: string,
  formData: FormData
) {
  await assertTripEditable(tripId);
  const targetDayId = String(formData.get("targetDayId") ?? "").trim();
  if (!targetDayId) return;
  await moveItemToDay(itemId, targetDayId);
  revalidateTrip(tripId);
}

export async function duplicateItemAction(
  tripId: string,
  sourceItemId: string,
  targetDayId: string
) {
  await assertTripEditable(tripId);
  await duplicateItem(sourceItemId, targetDayId);
  revalidateTrip(tripId);
}

export async function moveItemAction(
  tripId: string,
  items: { id: string; sortOrder: number }[],
  itemId: string,
  direction: "up" | "down"
) {
  await assertTripEditable(tripId);
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex((i) => i.id === itemId);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapWith < 0 || swapWith >= sorted.length) return;

  const a = sorted[idx];
  const b = sorted[swapWith];
  await reorderItems([
    { id: a.id, sortOrder: b.sortOrder },
    { id: b.id, sortOrder: a.sortOrder },
  ]);
  revalidateTrip(tripId);
}

export async function publishTripStatusAction(tripId: string, status: "draft" | "published" | "archived") {
  await updateTrip(tripId, { status });
  revalidateTrip(tripId);
}

export async function deleteTripAction(tripId: string, formData: FormData) {
  const trip = await getTripById(tripId);
  if (!trip) throw new Error("Viaje no encontrado.");
  if (String(formData.get("confirmTitle") ?? "") !== trip.title) {
    throw new Error("La confirmación no coincide con el nombre del viaje.");
  }
  await deleteTrip(tripId);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function setShowCostsToClientAction(
  tripId: string,
  slug: string,
  showCostsToClient: boolean
) {
  await assertTripEditable(tripId);
  await updateTrip(tripId, { showCostsToClient });
  revalidateTrip(tripId);
  revalidatePath(`/t/${slug}`);
}

export async function updateTripInstructionsAction(
  tripId: string,
  slug: string,
  formData: FormData
) {
  await assertTripEditable(tripId);
  const instructions = String(formData.get("instructions") ?? "").trim();
  await updateTrip(tripId, { instructions: instructions || null });
  revalidateTrip(tripId);
  revalidatePath(`/t/${slug}`);
}

export async function updateTripInternalNotesAction(tripId: string, formData: FormData) {
  await assertTripEditable(tripId);
  const internalNotes = String(formData.get("internalNotes") ?? "").trim();
  await updateTripInternalNotes(tripId, internalNotes || null);
  revalidateTrip(tripId);
}

export async function updateTripCurrencyAction(tripId: string, formData: FormData) {
  await assertTripEditable(tripId);
  const rawCurrency = String(formData.get("currency") ?? "MXN") as TripCurrency;
  if (!validCurrencies.includes(rawCurrency)) return;
  await updateTrip(tripId, { currency: rawCurrency });
  revalidateTrip(tripId);
}

export async function updateTripTravelerCountAction(
  tripId: string,
  slug: string,
  formData: FormData
) {
  await assertTripEditable(tripId);
  const raw = Number(formData.get("travelerCount"));
  if (!Number.isFinite(raw) || raw < 1) return;
  await updateTrip(tripId, { travelerCount: Math.floor(raw) });
  revalidateTrip(tripId);
  revalidatePath(`/t/${slug}`);
  revalidatePath("/dashboard");
}

export async function updateTripBudgetAction(tripId: string, formData: FormData) {
  await assertTripEditable(tripId);
  const raw = String(formData.get("budget") ?? "").trim();
  await updateTrip(tripId, { budget: raw ? Number(raw) : null });
  revalidateTrip(tripId);
}

function parseNullableNumber(raw: FormDataEntryValue | null): number | null {
  const value = String(raw ?? "").trim();
  return value ? Number(value) : null;
}

// Solo agente: sale_price/commission_rate (issue #53) nunca se propagan a
// revalidatePath(`/t/${slug}`) — la vista pública no depende de estos campos.
export async function updateTripCommissionAction(tripId: string, formData: FormData) {
  await assertTripEditable(tripId);
  await updateTrip(tripId, {
    salePrice: parseNullableNumber(formData.get("salePrice")),
    commissionRate: parseNullableNumber(formData.get("commissionRate")),
  });
  revalidateTrip(tripId);
}

export async function setTripClientsAction(tripId: string, formData: FormData) {
  await assertTripEditable(tripId);
  const clientIds = formData.getAll("clientIds").map(String).filter(Boolean);
  if (clientIds.length < 1) return; // no-op: server-side "mínimo 1 cliente" (defensa en profundidad)
  await setTripClients(tripId, clientIds);
  revalidateTrip(tripId);
  revalidatePath("/dashboard");
}

export async function setTripTagsAction(tripId: string, formData: FormData) {
  await assertTripEditable(tripId);
  const tagIds = formData.getAll("tagIds").map(String).filter(Boolean);
  const newTagNames = formData.getAll("newTagNames").map(String).filter(Boolean);
  for (const name of newTagNames) {
    const tag = await getOrCreateTag(name);
    tagIds.push(tag.id);
  }
  // 0 tags es válido (a diferencia de setTripClientsAction, sin guard de mínimo).
  await setTripTags(tripId, tagIds);
  revalidateTrip(tripId);
  revalidatePath("/dashboard");
}

export async function addPackingItemAction(tripId: string, formData: FormData) {
  await assertTripEditable(tripId);
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;
  await createPackingItem({ tripId, label });
  revalidateTrip(tripId);
}

export async function togglePackingItemAction(tripId: string, itemId: string, checked: boolean) {
  await assertTripEditable(tripId);
  await updatePackingItem(itemId, { checked });
  revalidateTrip(tripId);
}

export async function deletePackingItemAction(tripId: string, itemId: string) {
  await assertTripEditable(tripId);
  await deletePackingItem(itemId);
  revalidateTrip(tripId);
}

export async function uploadDocumentAction(tripId: string, itemId: string, formData: FormData) {
  await assertTripEditable(tripId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  await uploadItemDocument(itemId, file);
  revalidateTrip(tripId);
}

export async function deleteDocumentAction(tripId: string, documentId: string) {
  await assertTripEditable(tripId);
  await deleteDocument(documentId);
  revalidateTrip(tripId);
}

export async function getItemDocumentsAction(itemId: string) {
  return getItemDocuments(itemId);
}

export async function saveTripAsTemplateAction(tripId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const template = await saveTripAsTemplate(tripId, title);
  revalidatePath("/dashboard/trips/new");
  redirect(`/dashboard/trips/${template.id}`);
}

export async function uploadTripPhotoAction(tripId: string, slug: string, formData: FormData) {
  await assertTripEditable(tripId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  await uploadTripPhoto(tripId, file);
  revalidateTrip(tripId);
  revalidatePath(`/t/${slug}`);
}

export async function deleteTripPhotoAction(tripId: string, slug: string, photoId: string) {
  await assertTripEditable(tripId);
  await deleteTripPhoto(photoId);
  revalidateTrip(tripId);
  revalidatePath(`/t/${slug}`);
}

export async function uploadTripCoverAction(tripId: string, slug: string, formData: FormData) {
  await assertTripEditable(tripId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  await uploadTripCoverImage(tripId, file);
  revalidateTrip(tripId);
  revalidatePath(`/t/${slug}`);
}

export async function removeTripCoverAction(tripId: string, slug: string) {
  await assertTripEditable(tripId);
  await removeTripCoverImage(tripId);
  revalidateTrip(tripId);
  revalidatePath(`/t/${slug}`);
}

export async function uploadTripDocumentAction(tripId: string, slug: string, formData: FormData) {
  await assertTripEditable(tripId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  await uploadTripDocument(tripId, file);
  revalidateTrip(tripId);
  revalidatePath(`/t/${slug}`);
}

export async function deleteTripDocumentAction(tripId: string, slug: string, documentId: string) {
  await assertTripEditable(tripId);
  await deleteTripDocument(documentId);
  revalidateTrip(tripId);
  revalidatePath(`/t/${slug}`);
}

export async function getTripDocumentsAction(tripId: string) {
  return getTripDocuments(tripId);
}

// Clona un viaje completo (días + items, sin documentos) en un nuevo viaje en
// estado draft. Conserva los clientes asignados porque createTrip exige al
// menos 1 (regla de negocio en data.ts); título y slug quedan marcados como
// copia para que el usuario ajuste fechas/detalles del nuevo itinerario.
export async function duplicateTripAction(tripId: string) {
  const trip = await getTripById(tripId);
  if (!trip) return;

  const slugBase = slugify(trip.title) || "viaje";
  const slug = `${slugBase}-copia-${Date.now().toString(36)}`;

  const newTrip = await createTrip({
    clientIds: trip.clients.map((c) => c.id),
    title: `${trip.title} (copia)`,
    slug,
    startDate: trip.startDate,
    endDate: trip.endDate,
    coverImageUrl: trip.coverImageUrl,
    instructions: trip.instructions,
    travelerCount: trip.travelerCount,
    tagIds: trip.tags.map((t) => t.id),
  });

  for (const day of trip.days) {
    const newDay = await createTripDay({
      tripId: newTrip.id,
      date: day.date,
      notes: day.notes,
      sortOrder: day.sortOrder,
    });
    for (const item of day.items) {
      await createItem({
        tripDayId: newDay.id,
        type: item.type,
        title: item.title,
        startTime: item.startTime,
        endTime: item.endTime,
        location: item.location,
        lat: item.lat,
        lng: item.lng,
        confirmationCode: item.confirmationCode,
        notes: item.notes,
        sortOrder: item.sortOrder,
      });
    }
  }

  redirect(`/dashboard/trips/${newTrip.id}`);
}
