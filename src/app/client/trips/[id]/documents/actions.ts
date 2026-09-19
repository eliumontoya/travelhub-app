"use server";

import { revalidatePath } from "next/cache";
import { getClientSession } from "@/lib/client-auth";
import {
  getServiceForClientTrip,
  getServiceWithChecklist,
  uploadServiceDocument,
} from "@/lib/data/services";

export async function uploadDocument(
  serviceId: string,
  checklistItemId: string,
  formData: FormData
) {
  const session = await getClientSession();
  if (!session) {
    throw new Error("Sesión requerida");
  }

  const requested = await getServiceWithChecklist(serviceId);
  if (requested.clientId !== session.clientId) {
    throw new Error("Acceso no autorizado");
  }

  const owned = await getServiceForClientTrip(
    session.clientId,
    requested.tripId
  );
  if (!owned || owned.id !== serviceId) {
    throw new Error("Servicio no encontrado");
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    throw new Error("No se seleccionó ningún archivo");
  }

  await uploadServiceDocument(serviceId, checklistItemId, file);
  revalidatePath(`/client/trips/${owned.tripId}/documents`);
}
