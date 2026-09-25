import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { currentMockAccountId, mockProfiles } from "@/lib/mock-data";
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

export async function getCurrentAccount(mockAccountId?: string): Promise<AccountProfile | null> {
  if (!isSupabaseConfigured()) {
    const accountId = mockAccountId ?? currentMockAccountId;
    return mockProfiles[accountId] ?? null;
  }

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
    features: data.features ?? [],
    travelAgentId: data.travel_agent_id ?? undefined,
  };
}

export async function getCurrentUserRole(mockAccountId?: string): Promise<AccountRole | null> {
  const account = await getCurrentAccount(mockAccountId);
  return account?.role ?? null;
}

export async function getCurrentTravelAgentId(mockAccountId?: string): Promise<string | null> {
  const account = await getCurrentAccount(mockAccountId);
  return account?.travelAgentId ?? null;
}

export async function requireRole(...allowed: AccountRole[]): Promise<AccountRole> {
  const role = await getCurrentUserRole();
  if (!hasRole(role, allowed)) {
    throw new Error("Unauthorized");
  }
  return role as AccountRole;
}
