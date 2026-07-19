"use server";

import { redirect } from "next/navigation";
import {
  createClient as createClientRecord,
  createTrip,
  createTripFromTemplate,
  getOrCreateTag,
} from "@/lib/data";

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createTripAction(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const instructions = String(formData.get("instructions") ?? "").trim() || undefined;
  const clientIds = formData.getAll("clientIds").map(String).filter(Boolean);
  const tagIds = formData.getAll("tagIds").map(String).filter(Boolean);
  const newTagNames = formData.getAll("newTagNames").map(String).filter(Boolean);
  const templateId = String(formData.get("templateId") ?? "").trim() || undefined;

  const newClientName = String(formData.get("newClientName") ?? "").trim();
  if (newClientName) {
    const client = await createClientRecord({
      name: newClientName,
      email: String(formData.get("newClientEmail") ?? "").trim() || undefined,
      phone: String(formData.get("newClientPhone") ?? "").trim() || undefined,
    });
    clientIds.push(client.id);
  }

  for (const name of newTagNames) {
    const tag = await getOrCreateTag(name);
    tagIds.push(tag.id);
  }

  if (!title) {
    redirect(`/dashboard/trips/new?error=${encodeURIComponent("El título es obligatorio")}`);
  }
  if (clientIds.length < 1) {
    redirect(`/dashboard/trips/new?error=${encodeURIComponent("Selecciona al menos un cliente")}`);
  }

  const slugBase = slugify(title) || "viaje";
  const slug = `${slugBase}-${Date.now().toString(36)}`;

  const tripInput = { clientIds, title, slug, startDate, endDate, instructions, tagIds };
  const trip = templateId
    ? await createTripFromTemplate(templateId, tripInput)
    : await createTrip(tripInput);
  redirect(`/dashboard/trips/${trip.id}`);
}
