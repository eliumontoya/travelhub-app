import { SiteSettings } from "@/types";
import { mockSiteSettings } from "@/lib/mock-data";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/data/shared";

// ---------- Site settings (contacto público, fila singleton) ----------

export async function getSiteSettings(): Promise<SiteSettings> {
  if (!isSupabaseConfigured()) return mockSiteSettings;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  return data
    ? rowToSiteSettings(data)
    : { email: "", phone: "", agencyName: "", logoUrl: "" };
}

export async function updateSiteSettings(
  input: Partial<SiteSettings>
): Promise<SiteSettings> {
  if (!isSupabaseConfigured()) {
    if (input.email !== undefined) mockSiteSettings.email = input.email;
    if (input.phone !== undefined) mockSiteSettings.phone = input.phone;
    if (input.agencyName !== undefined) mockSiteSettings.agencyName = input.agencyName;
    if (input.logoUrl !== undefined) mockSiteSettings.logoUrl = input.logoUrl;
    return mockSiteSettings;
  }
  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = { id: 1 };
  if (input.email !== undefined) patch.email = input.email;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.agencyName !== undefined) patch.agency_name = input.agencyName;
  if (input.logoUrl !== undefined) patch.logo_url = input.logoUrl;
  const { data, error } = await supabase
    .from("site_settings")
    .upsert(patch)
    .select()
    .single();
  if (error) throw error;
  return rowToSiteSettings(data);
}

function rowToSiteSettings(row: Record<string, unknown>): SiteSettings {
  return {
    email: (row.email as string) ?? "",
    phone: (row.phone as string) ?? "",
    agencyName: (row.agency_name as string) ?? "",
    logoUrl: (row.logo_url as string) ?? "",
  };
}

