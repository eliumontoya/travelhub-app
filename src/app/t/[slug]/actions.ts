"use server";

import { revalidatePath } from "next/cache";
import { createTripFeedback } from "@/lib/data";

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
