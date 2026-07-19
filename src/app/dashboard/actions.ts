"use server";

import { revalidatePath } from "next/cache";
import { updateTrip } from "@/lib/data";

export async function bulkUpdateTripStatusAction(
  tripIds: string[],
  status: "published" | "archived"
) {
  for (const id of tripIds) {
    await updateTrip(id, { status });
  }
  revalidatePath("/dashboard");
}
