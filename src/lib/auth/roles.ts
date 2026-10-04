import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { filterFeatures } from "@/lib/auth/features";
import type { AccountProfile, AccountRole, Feature } from "@/types";

export function normalizeRole(value: unknown): AccountRole | null {
  if (value === "admin" || value === "agent") {
    return value;
  }
  return null;
}

export function hasRole(role: AccountRole | null, allowed: AccountRole[]): boolean {
  if (!role) return false;
  return allowed.includes(role);
}

export function canAccessFeature(profile: AccountProfile | null, feature: Feature): boolean {
  if (!profile) return false;
  if (profile.role === "admin") return true;
  return profile.features.includes(feature);
}

export async function getCurrentAccount(): Promise<AccountProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, features, travel_agent_id")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  const role = normalizeRole(data.role);
  if (!role) return null;

  return {
    id: data.id,
    role,
    features: filterFeatures(data.features ?? []),
    travelAgentId: data.travel_agent_id ?? undefined,
  };
}

export async function getCurrentUserRole(): Promise<AccountRole | null> {
  const account = await getCurrentAccount();
  return account?.role ?? null;
}

export async function getCurrentTravelAgentId(): Promise<string | null> {
  const account = await getCurrentAccount();
  return account?.travelAgentId ?? null;
}

export async function requireRole(...allowed: AccountRole[]): Promise<AccountRole> {
  const role = await getCurrentUserRole();
  if (!hasRole(role, allowed)) {
    throw new Error("Unauthorized");
  }
  return role as AccountRole;
}

/**
 * Server-side route guard: resolve the current account and ensure they can
 * access the given feature. Redirects to `/dashboard` on denial (no account,
 * or agent without the feature). Admins always pass.
 *
 * Returns the resolved `AccountProfile` on success so callers can reuse it
 * without re-fetching.
 */
export async function requireFeature(feature: Feature): Promise<AccountProfile> {
  const account = await getCurrentAccount();
  if (!account || !canAccessFeature(account, feature)) {
    redirect("/dashboard");
  }
  return account;
}

/**
 * Server-side admin guard: resolves the current account and requires
 * `role === "admin"`. Redirects to `/dashboard` on denial. Returns the
 * resolved admin profile on success.
 */
export async function requireAdmin(): Promise<AccountProfile> {
  const account = await getCurrentAccount();
  if (!account || account.role !== "admin") {
    redirect("/dashboard");
  }
  return account;
}
