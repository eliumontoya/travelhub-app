"use server";

import { redirect } from "next/navigation";
import { createClient as createClientRecord, createTrip } from "@/lib/data";

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
  let clientId = String(formData.get("clientId") ?? "");

  const newClientName = String(formData.get("newClientName") ?? "").trim();
  if (!clientId && newClientName) {
    const client = await createClientRecord({
      name: newClientName,
      email: String(formData.get("newClientEmail") ?? "").trim() || undefined,
      phone: String(formData.get("newClientPhone") ?? "").trim() || undefined,
    });
    clientId = client.id;
  }

  if (!title || !clientId) {
    redirect(`/dashboard/trips/new?error=${encodeURIComponent("Título y cliente son obligatorios")}`);
  }

  const slugBase = slugify(title) || "viaje";
  const slug = `${slugBase}-${Date.now().toString(36)}`;

  const trip = await createTrip({ clientId, title, slug, startDate, endDate, instructions });
  redirect(`/dashboard/trips/${trip.id}`);
}
