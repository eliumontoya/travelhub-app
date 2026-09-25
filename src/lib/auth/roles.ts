import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import { currentMockAccountId, mockProfiles } from "@/lib/mock-data";
import { filterFeatures } from "@/lib/auth/features";
import type { AccountProfile, AccountRole, Feature } from "@/types";

/**
 * Cookie name used by the dev/test mock-mode override. The dashboard layout
 * and middleware both honor this cookie to switch the effective mock account.
 */
export const MOCK_ACCOUNT_COOKIE = "x-mock-account-id";

/**
 * Resolve the effective mock account id: an explicit id wins, otherwise we
 * fall back to the `x-mock-account-id` cookie (used by dev/test harnesses).
 * Returns `undefined` when neither is present — the caller decides what to
 * do with that (typically `getCurrentAccount` falls back to its module-level
 * `currentMockAccountId` default).
 */
export async function resolveMockAccountId(mockAccountId?: string): Promise<string | undefined> {
  if (mockAccountId) return mockAccountId;
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(MOCK_ACCOUNT_COOKIE)?.value;
  return fromCookie ?? undefined;
}

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
    const profile = mockProfiles[accountId];
    if (!profile) return null;
    // Defensive: drop unknown feature strings (DB drift, stale mocks) so the
    // resolved account only exposes recognized catalog features. We return a
    // filtered copy — the in-memory profile is left untouched.
    return { ...profile, features: filterFeatures(profile.features) };
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
    features: filterFeatures(data.features ?? []),
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

/**
 * Server-side route guard: resolve the current account and ensure they can
 * access the given feature. Redirects to `/dashboard` on denial (no account,
 * or agent without the feature). Admins always pass.
 *
 * Returns the resolved `AccountProfile` on success so callers can reuse it
 * without re-fetching.
 */
export async function requireFeature(
  feature: Feature,
  mockAccountId?: string,
): Promise<AccountProfile> {
  const accountId = await resolveMockAccountId(mockAccountId);
  const account = await getCurrentAccount(accountId);
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
export async function requireAdmin(mockAccountId?: string): Promise<AccountProfile> {
  const accountId = await resolveMockAccountId(mockAccountId);
  const account = await getCurrentAccount(accountId);
  if (!account || account.role !== "admin") {
    redirect("/dashboard");
  }
  return account;
}
