import type { SupabaseClient } from "@supabase/supabase-js";
import { filterFeatures } from "@/lib/auth/features";
import type { AccountProfile, AccountRole } from "@/types";

/**
 * Normalize a persisted role value to the `AccountRole` union. Any value other
 * than the recognized roles resolves to `null` so DB drift cannot leak into
 * authorization checks.
 */
export function normalizeRole(value: unknown): AccountRole | null {
  if (value === "admin" || value === "agent") {
    return value;
  }
  return null;
}

/**
 * Shape of the `profiles` row consumed by `resolveAccountProfile`. The
 * resolver casts the Supabase response to this row before normalizing role and
 * filtering features.
 */
export interface ProfileRow {
  id: string;
  role: unknown;
  features: unknown;
  travel_agent_id: string | null;
}

/**
 * Client surface required by `resolveAccountProfile`. Uses the Supabase client
 * type because its generic query builders are not structurally assignable to a
 * hand-written interface (TS2589). This module MUST stay free of
 * `next/headers` and `next/navigation` imports so the Edge middleware can
 * consume the resolver.
 */
export type ProfileResolverClient = SupabaseClient;

/**
 * Resolve a user's `AccountProfile` from the `profiles` table. Shared by
 * `getCurrentAccount()` and the dashboard middleware so role normalization and
 * feature filtering cannot drift between the gate and the guards.
 *
 * Returns `null` when the row is missing or the persisted role is not
 * recognized.
 */
export async function resolveAccountProfile(
  client: ProfileResolverClient,
  userId: string,
): Promise<AccountProfile | null> {
  const { data, error } = await client
    .from("profiles")
    .select("id, role, features, travel_agent_id")
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  const row = data as ProfileRow;
  const role = normalizeRole(row.role);
  if (!role) return null;

  return {
    id: row.id,
    role,
    features: filterFeatures(row.features ?? []),
    travelAgentId: row.travel_agent_id ?? undefined,
  };
}
