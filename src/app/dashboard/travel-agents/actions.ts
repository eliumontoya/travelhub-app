"use server";

import { TravelAgent } from "@/types";
import {
  createTravelAgent,
  updateTravelAgent,
  deleteTravelAgent,
} from "@/lib/data";

export async function createTravelAgentAction(
  formData: FormData
): Promise<{ agent?: TravelAgent; error?: string }> {
  const name = (formData.get("name") as string)?.trim();
  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  try {
    const agent = await createTravelAgent({
      name,
      email: (formData.get("email") as string)?.trim() || undefined,
      phone: (formData.get("phone") as string)?.trim() || undefined,
      notes: (formData.get("notes") as string)?.trim() || undefined,
    });
    return { agent };
  } catch {
    return { error: "Error al crear el agente." };
  }
}

export async function updateTravelAgentAction(
  agentId: string,
  formData: FormData
): Promise<{ agent?: TravelAgent; error?: string }> {
  const name = (formData.get("name") as string)?.trim();
  if (!name) {
    return { error: "El nombre es obligatorio." };
  }

  try {
    const agent = await updateTravelAgent(agentId, {
      name,
      email: (formData.get("email") as string)?.trim() || undefined,
      phone: (formData.get("phone") as string)?.trim() || undefined,
      notes: (formData.get("notes") as string)?.trim() || undefined,
    });
    return { agent };
  } catch {
    return { error: "Error al actualizar el agente." };
  }
}

export async function deleteTravelAgentAction(
  agentId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await deleteTravelAgent(agentId);
    return { ok: true };
  } catch {
    return { ok: false, error: "Error al eliminar el agente." };
  }
}
