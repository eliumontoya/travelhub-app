"use server";

import { Client } from "@/types";
import { createClient, getClientByEmail } from "@/lib/data";

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
    const client = await createClient({
      name,
      email: email || undefined,
      phone: (formData.get("phone") as string)?.trim() || undefined,
      birthDate: (formData.get("birthDate") as string)?.trim() || undefined,
    });
    return { client };
  } catch {
    return { error: "Error al crear el cliente." };
  }
}
