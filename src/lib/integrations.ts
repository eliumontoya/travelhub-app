import { isSupabaseConfigured } from "@/lib/supabase/server";

export type IntegrationStatus = {
  id: string;
  label: string;
  configured: boolean;
};

function isGoogleMapsConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
}

export function getIntegrationsStatus(): IntegrationStatus[] {
  return [
    { id: "supabase", label: "Supabase", configured: isSupabaseConfigured() },
    { id: "google-maps", label: "Google Maps", configured: isGoogleMapsConfigured() },
  ];
}
