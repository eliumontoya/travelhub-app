"use server";

import { revalidatePath } from "next/cache";
import { updateClient } from "@/lib/data";

export async function updateClientAction(clientId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await updateClient(clientId, {
    name,
    email: String(formData.get("email") ?? "").trim() || undefined,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim() || undefined,
    birthDate: String(formData.get("birthDate") ?? "").trim() || undefined,
  });
  revalidatePath(`/dashboard/clients/${clientId}`);
}
