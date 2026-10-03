// ---------- Helpers privados compartidos de servicios ----------
//
// Extraído de src/lib/data/services.ts. Este módulo es interno: NO se reexporta
// desde src/lib/data.ts para no ampliar la API pública de @/lib/data.

import { ServiceType } from "@/types";
import {
  canUseServiceRole,
  createServerSupabase,
  isSupabaseConfigured,
} from "@/lib/data/shared";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_SERVICE_TYPE: ServiceType = "trip_documents";

export async function getServiceClient(): Promise<SupabaseClient> {
  if (canUseServiceRole()) return getSupabaseAdmin();
  if (isSupabaseConfigured()) return await createServerSupabase();
  throw new Error("Supabase no está configurado");
}

export function nowIso() {
  return new Date().toISOString();
}
