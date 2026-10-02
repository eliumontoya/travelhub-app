"use server";

import { redirect } from "next/navigation";
import { createVisa } from "@/lib/data";
import { requireFeature, requireRole } from "@/lib/auth/roles";

/**
 * Server action for creating a new visa application from the dashboard form.
 * - Requires an authenticated agent with the `visas` feature enabled.
 * - Validates the four required fields (country, visaType, deadline, price).
 * - On success, redirects to the new visa's detail page.
 * - On validation error, redirects back to the form with an error query param.
 */
export async function createVisaAction(formData: FormData) {
  await requireRole("admin", "agent");
  await requireFeature("visas");

  const country = String(formData.get("country") ?? "").trim();
  const visaType = String(formData.get("visaType") ?? "").trim();
  const deadline = String(formData.get("deadline") ?? "").trim();
  const priceRaw = String(formData.get("price") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const clientIds = formData
    .getAll("clientIds")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!country) {
    redirect(`/dashboard/visas/new?error=${encodeURIComponent("El país es obligatorio")}`);
  }
  if (!visaType) {
    redirect(`/dashboard/visas/new?error=${encodeURIComponent("El tipo de visa es obligatorio")}`);
  }
  if (!deadline) {
    redirect(
      `/dashboard/visas/new?error=${encodeURIComponent("La fecha límite es obligatoria")}`,
    );
  }

  const price = Number(priceRaw);
  if (!Number.isFinite(price) || price < 0) {
    redirect(
      `/dashboard/visas/new?error=${encodeURIComponent("El precio debe ser un número válido")}`,
    );
  }

  const visa = await createVisa({
    country,
    visaType,
    deadline,
    price,
    notes,
    clientIds,
  });

  redirect(`/dashboard/visas/${visa.id}`);
}
