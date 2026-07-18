"use server";

import { revalidatePath } from "next/cache";
import {
  createItem,
  createTripDay,
  deleteItem,
  deleteTripDay,
  reorderItems,
  reorderTripDays,
  updateItem,
  updateTrip,
  updateTripDay,
} from "@/lib/data";
import { ItemType } from "@/types";

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
    confirmationCode: String(formData.get("confirmationCode") ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim() || undefined,
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
    confirmationCode: String(formData.get("confirmationCode") ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim() || undefined,
  });
  revalidateTrip(tripId);
}

export async function deleteItemAction(tripId: string, itemId: string) {
  await deleteItem(itemId);
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
