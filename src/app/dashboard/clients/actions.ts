"use server";

import { revalidatePath } from "next/cache";
import { Client } from "@/types";
import { createClient, deleteClient, getClientByEmail, getClientById } from "@/lib/data";

export async function createClientAction(
  formData: FormData
): Promise<{ client?: Client; error?: string }> {
  const name = (formData.get("name") as string)?.trim();
  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  const email = (formData.get("email") as string)?.trim();
  if (email) {
    const existing = await getClientByEmail(email);
    if (existing) {
      return { error: "Ya existe un cliente con ese email." };
    }
  }

  try {
    const phone = (formData.get("phone") as string)?.trim() || undefined;
    const whatsapp = (formData.get("whatsapp") as string)?.trim() || phone;
    const client = await createClient({
      name,
      email: email || undefined,
      phone,
      whatsapp,
      referralSource: (formData.get("referralSource") as string)?.trim() || undefined,
      birthDate: (formData.get("birthDate") as string)?.trim() || undefined,
    });
    return { client };
  } catch {
    return { error: "Error al crear el cliente." };
  }
}

export async function deleteClientAction(
  clientId: string,
  formData: FormData
): Promise<void> {
  const client = await getClientById(clientId);
  if (!client) return;

  const confirmationName = String(formData.get("confirmationName") ?? "").trim();
  if (confirmationName !== client.name) return;

  await deleteClient(clientId);
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/clients/${clientId}`);
}
