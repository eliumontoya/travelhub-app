"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createTravelerActivity,
  createTripFeedback,
  deleteTravelerActivity,
  updateTravelerActivity,
} from "@/lib/data";
import { getClientSession } from "@/lib/client-auth";

export type TravelerActivityActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const travelerActivitySchema = z.object({
  title: z.string().trim().min(1).max(120),
  startTime: z.string().trim(),
  location: z.string().trim().max(200),
  notes: z.string().trim().max(2_000),
}).superRefine((value, context) => {
  if (value.startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.startTime)) {
    context.addIssue({ code: "custom", path: ["startTime"], message: "Invalid time" });
  }
});

function getFormText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function parseTravelerActivityForm(formData: FormData) {
  const parsed = travelerActivitySchema.safeParse({
    title: getFormText(formData, "title"),
    startTime: getFormText(formData, "startTime"),
    location: getFormText(formData, "location"),
    notes: getFormText(formData, "notes"),
  });
  if (!parsed.success) return null;

  return {
    title: parsed.data.title,
    startTime: parsed.data.startTime || undefined,
    location: parsed.data.location || undefined,
    notes: parsed.data.notes || undefined,
  };
}

async function getAuthenticatedClientId(): Promise<string | null> {
  const session = await getClientSession();
  return session?.clientId ?? null;
}

function failure(message: string): TravelerActivityActionState {
  return { status: "error", message };
}

function revalidatePublicTrip(slug: string) {
  revalidatePath(`/t/${slug}`);
}

export async function createTravelerActivityAction(
  tripId: string,
  tripDayId: string,
  slug: string,
  _previousState: TravelerActivityActionState,
  formData: FormData
): Promise<TravelerActivityActionState> {
  const clientId = await getAuthenticatedClientId();
  if (!clientId) return failure("Iniciá sesión para modificar actividades.");

  const fields = parseTravelerActivityForm(formData);
  if (!fields) return failure("Revisá los datos de la actividad.");

  try {
    const result = await createTravelerActivity({ tripId, tripDayId, clientId, ...fields });
    if (!result.ok) {
      return failure(result.reason === "invalid" ? "Revisá los datos de la actividad." : "No tenés permisos para modificar esta actividad.");
    }
  } catch {
    return failure("No se pudo guardar la actividad. Intentá de nuevo.");
  }

  revalidatePublicTrip(slug);
  return { status: "success", message: "Actividad agregada." };
}

export async function updateTravelerActivityAction(
  tripId: string,
  tripDayId: string,
  itemId: string,
  slug: string,
  _previousState: TravelerActivityActionState,
  formData: FormData
): Promise<TravelerActivityActionState> {
  const clientId = await getAuthenticatedClientId();
  if (!clientId) return failure("Iniciá sesión para modificar actividades.");

  const fields = parseTravelerActivityForm(formData);
  if (!fields) return failure("Revisá los datos de la actividad.");

  try {
    const result = await updateTravelerActivity({ tripId, tripDayId, itemId, clientId, ...fields });
    if (!result.ok) {
      return failure(result.reason === "invalid" ? "Revisá los datos de la actividad." : "No tenés permisos para modificar esta actividad.");
    }
  } catch {
    return failure("No se pudo guardar la actividad. Intentá de nuevo.");
  }

  revalidatePublicTrip(slug);
  return { status: "success", message: "Actividad actualizada." };
}

export async function deleteTravelerActivityAction(
  tripId: string,
  tripDayId: string,
  itemId: string,
  slug: string,
  _previousState: TravelerActivityActionState,
  _formData: FormData
): Promise<TravelerActivityActionState> {
  const clientId = await getAuthenticatedClientId();
  if (!clientId) return failure("Iniciá sesión para modificar actividades.");

  try {
    const result = await deleteTravelerActivity({ tripId, tripDayId, itemId, clientId });
    if (!result.ok) return failure("No tenés permisos para modificar esta actividad.");
  } catch {
    return failure("No se pudo eliminar la actividad. Intentá de nuevo.");
  }

  revalidatePublicTrip(slug);
  return { status: "success", message: "Actividad eliminada." };
}

export async function submitTripFeedbackAction(
  tripId: string,
  slug: string,
  formData: FormData
) {
  const rating = Number(formData.get("rating"));
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;
  const comment = String(formData.get("comment") ?? "").trim() || undefined;
  await createTripFeedback({ tripId, rating, comment });
  revalidatePath(`/t/${slug}`);
}
