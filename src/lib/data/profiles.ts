import type { AccountProfile, Feature } from "@/types";
import { filterFeatures } from "@/lib/auth/features";
import { mockProfiles } from "@/lib/mock-data";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/data/shared";
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Maps a row from the `profiles` table to an `AccountProfile`. Unknown feature
 * strings are dropped defensively so DB drift cannot leak into feature checks.
 */
export function rowToProfile(row: Record<string, unknown>): AccountProfile {
  const role = row.role as AccountProfile["role"];
  const features = filterFeatures(row.features);
  const travelAgentId = row.travel_agent_id;
  return {
    id: row.id as string,
    role,
    features,
    travelAgentId: typeof travelAgentId === "string" ? travelAgentId : undefined,
  };
}

/**
 * Admin-only read of every profile in the system.
 *
 * Mock: returns `Object.values(mockProfiles)` with features defensively filtered.
 * Supabase: queries `profiles` ordered by `created_at` and maps rows through
 * `rowToProfile`. RLS enforces admin-only access (see migration).
 */
export async function listProfiles(): Promise<AccountProfile[]> {
  if (!isSupabaseConfigured()) {
    return Object.values(mockProfiles).map((profile) => ({
      ...profile,
      features: filterFeatures(profile.features),
    }));
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, features, travel_agent_id")
    .order("created_at");
  if (error) throw error;
  const profiles = (data ?? []).map(rowToProfile);

  const ids = profiles.map((p) => p.id);
  const agentIds = profiles
    .map((p) => p.travelAgentId)
    .filter((id): id is string => Boolean(id));

  const [emailMap, agentNameMap] = await Promise.all([
    resolveUserEmails(ids),
    resolveAgentNames(agentIds),
  ]);

  return profiles.map((p) => ({
    ...p,
    email: emailMap.get(p.id),
    travelAgentName: p.travelAgentId ? agentNameMap.get(p.travelAgentId) : undefined,
  }));
}

async function resolveUserEmails(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin.auth.admin.listUsers();
    for (const user of data.users) {
      if (ids.includes(user.id) && user.email) {
        map.set(user.id, user.email);
      }
    }
  } catch {
    // Service role not configured or admin API unavailable — emails stay undefined.
  }
  return map;
}

async function resolveAgentNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("travel_agents")
    .select("id, name")
    .in("id", ids);
  for (const row of data ?? []) {
    map.set(row.id as string, row.name as string);
  }
  return map;
}

/**
 * Admin-only write of a profile's features. Unknown feature strings in the
 * input are dropped before persistence (defense in depth: the admin toggle UI
 * only emits recognized values, but untrusted callers are still rejected).
 *
 * Mock: mutates `mockProfiles[id].features` in place so subsequent reads see
 * the new value.
 * Supabase: `update({ features, updated_at })` filtered by id, then re-selects
 * the canonical columns and returns the mapped row. RLS enforces admin-only.
 */
export async function updateProfileFeatures(
  id: string,
  features: Feature[],
): Promise<AccountProfile> {
  const sanitized = filterFeatures(features);

  if (!isSupabaseConfigured()) {
    const profile = mockProfiles[id];
    if (!profile) {
      throw new Error("Perfil no encontrado");
    }
    profile.features = sanitized;
    return { ...profile, features: filterFeatures(profile.features) };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .update({ features: sanitized, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, role, features, travel_agent_id")
    .single();
  if (error) throw error;
  return rowToProfile(data as Record<string, unknown>);
}
