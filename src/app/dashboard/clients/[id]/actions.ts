"use server";

import { revalidatePath } from "next/cache";
import { getOrCreateTag, setClientTags, updateClient } from "@/lib/data";

export async function updateClientAction(clientId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await updateClient(clientId, {
    name,
    email: String(formData.get("email") ?? "").trim() || undefined,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim() || undefined,
    referralSource: String(formData.get("referralSource") ?? "").trim() || undefined,
    birthDate: String(formData.get("birthDate") ?? "").trim() || undefined,
  });
  revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function setClientTagsAction(clientId: string, formData: FormData) {
  const tagIds = formData.getAll("tagIds").map(String).filter(Boolean);
  const newTagNames = formData.getAll("newTagNames").map(String).filter(Boolean);
  for (const name of newTagNames) {
    const tag = await getOrCreateTag(name);
    tagIds.push(tag.id);
  }
  // 0 tags es válido (mismo patrón que setTripTagsAction).
  await setClientTags(clientId, tagIds);
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard");
}
