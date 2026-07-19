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
  deletePackingItem,
  deleteTripDay,
  deleteTripPhoto,
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
  uploadItemDocument,
  uploadTripPhoto,
} from "@/lib/data";
import { ItemType } from "@/types";

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

export async function addDayAction(tripId: string, formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  if (!date) return;
  await createTripDay({ tripId, date, notes });
  revalidateTrip(tripId);
}

export async function editDayAction(tripId: string, dayId: string, formData: FormData) {
  const date = String(formData.get("date") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  await updateTripDay(dayId, { date: date || undefined, notes });
  revalidateTrip(tripId);
}

export async function deleteDayAction(tripId: string, dayId: string) {
  await deleteTripDay(dayId);
  revalidateTrip(tripId);
}

export async function restoreDayAction(tripId: string, dayId: string) {
  await restoreTripDay(dayId);
  revalidateTrip(tripId);
}

export async function moveDayAction(
  tripId: string,
  days: { id: string; sortOrder: number }[],
  dayId: string,
  direction: "up" | "down"
) {
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
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await createItem({
    tripDayId: dayId,
    type: String(formData.get("type") ?? "note") as ItemType,
    title,
    startTime: String(formData.get("startTime") ?? "").trim() || undefined,
    endTime: String(formData.get("endTime") ?? "").trim() || undefined,
    location: String(formData.get("location") ?? "").trim() || undefined,
    lat: parseCoord(formData.get("lat")),
    lng: parseCoord(formData.get("lng")),
    confirmationCode: String(formData.get("confirmationCode") ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim() || undefined,
    cost: parseCost(formData.get("cost")),
  });
  revalidateTrip(tripId);
}

export async function editItemAction(tripId: string, itemId: string, formData: FormData) {
  await updateItem(itemId, {
    type: String(formData.get("type") ?? "note") as ItemType,
    title: String(formData.get("title") ?? "").trim(),
    startTime: String(formData.get("startTime") ?? "").trim() || undefined,
    endTime: String(formData.get("endTime") ?? "").trim() || undefined,
    location: String(formData.get("location") ?? "").trim() || undefined,
    lat: parseCoord(formData.get("lat")),
    lng: parseCoord(formData.get("lng")),
    confirmationCode: String(formData.get("confirmationCode") ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim() || undefined,
    cost: parseCost(formData.get("cost")),
  });
  revalidateTrip(tripId);
}

export async function deleteItemAction(tripId: string, itemId: string) {
  await deleteItem(itemId);
  revalidateTrip(tripId);
}

export async function restoreItemAction(tripId: string, itemId: string) {
  await restoreItem(itemId);
  revalidateTrip(tripId);
}

export async function moveItemAction(
  tripId: string,
  items: { id: string; sortOrder: number }[],
  itemId: string,
  direction: "up" | "down"
) {
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

export async function setShowCostsToClientAction(
  tripId: string,
  slug: string,
  showCostsToClient: boolean
) {
  await updateTrip(tripId, { showCostsToClient });
  revalidateTrip(tripId);
  revalidatePath(`/t/${slug}`);
}

export async function updateTripInstructionsAction(
  tripId: string,
  slug: string,
  formData: FormData
) {
  const instructions = String(formData.get("instructions") ?? "").trim();
  await updateTrip(tripId, { instructions: instructions || null });
  revalidateTrip(tripId);
  revalidatePath(`/t/${slug}`);
}

export async function updateTripTravelerCountAction(
  tripId: string,
  slug: string,
  formData: FormData
) {
  const raw = Number(formData.get("travelerCount"));
  if (!Number.isFinite(raw) || raw < 1) return;
  await updateTrip(tripId, { travelerCount: Math.floor(raw) });
  revalidateTrip(tripId);
  revalidatePath(`/t/${slug}`);
  revalidatePath("/dashboard");
}

export async function updateTripBudgetAction(tripId: string, formData: FormData) {
  const raw = String(formData.get("budget") ?? "").trim();
  await updateTrip(tripId, { budget: raw ? Number(raw) : null });
  revalidateTrip(tripId);
}

export async function setTripClientsAction(tripId: string, formData: FormData) {
  const clientIds = formData.getAll("clientIds").map(String).filter(Boolean);
  if (clientIds.length < 1) return; // no-op: server-side "mínimo 1 cliente" (defensa en profundidad)
  await setTripClients(tripId, clientIds);
  revalidateTrip(tripId);
  revalidatePath("/dashboard");
}

export async function setTripTagsAction(tripId: string, formData: FormData) {
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
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;
  await createPackingItem({ tripId, label });
  revalidateTrip(tripId);
}

export async function togglePackingItemAction(tripId: string, itemId: string, checked: boolean) {
  await updatePackingItem(itemId, { checked });
  revalidateTrip(tripId);
}

export async function deletePackingItemAction(tripId: string, itemId: string) {
  await deletePackingItem(itemId);
  revalidateTrip(tripId);
}

export async function uploadDocumentAction(tripId: string, itemId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  await uploadItemDocument(itemId, file);
  revalidateTrip(tripId);
}

export async function deleteDocumentAction(tripId: string, documentId: string) {
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
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  await uploadTripPhoto(tripId, file);
  revalidateTrip(tripId);
  revalidatePath(`/t/${slug}`);
}

export async function deleteTripPhotoAction(tripId: string, slug: string, photoId: string) {
  await deleteTripPhoto(photoId);
  revalidateTrip(tripId);
  revalidatePath(`/t/${slug}`);
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
