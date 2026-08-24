"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { updateSiteSettings, uploadSiteLogo } from "@/lib/data";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SettingsFormState = { error?: string } | null;

export async function updateSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const agencyName = String(formData.get("agencyName") ?? "").trim();
  const existingLogoUrl = String(formData.get("logoUrl") ?? "").trim();

  if (!email || !EMAIL_RE.test(email)) {
    return { error: "Ingresa un email válido." };
  }
  if (!phone) {
    return { error: "El teléfono es obligatorio." };
  }

  let logoUrl = existingLogoUrl;
  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    try {
      logoUrl = await uploadSiteLogo(logoFile);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "No se pudo subir el logo." };
    }
  }

  await updateSiteSettings({ email, phone, agencyName, logoUrl });

  revalidatePath("/dashboard/settings");
  // Invalida todas las páginas públicas /t/[slug] a la vez: el contacto y la
  // marca son globales, no por viaje (ver design D4).
  revalidatePath("/t/[slug]", "page");

  return null;
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
