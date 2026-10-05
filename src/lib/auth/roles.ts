import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { AccountProfile, AccountRole, Feature } from "@/types";
import { resolveAccountProfile } from "@/lib/auth/profile";

// Public API unchanged: `normalizeRole` stays re-exported from this module.
export { normalizeRole } from "@/lib/auth/profile";

export function hasRole(role: AccountRole | null, allowed: AccountRole[]): boolean {
  if (!role) return false;
  return allowed.includes(role);
}

export function canAccessFeature(profile: AccountProfile | null, feature: Feature): boolean {
  if (!profile) return false;
  if (profile.role === "admin") return true;
  return profile.features.includes(feature);
}

/**
 * Identity-only helper: resolve the authenticated Supabase Auth user. Does not
 * touch `profiles`, so it is safe for places that only render identity (e.g.
 * the dashboard layout's profile menu email).
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Throw-style identity helper for Server Actions and Route Handlers. Throws
 * `Error("Unauthorized")` when there is no authenticated session.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

/**
 * Non-throwing admin predicate for Server Actions that return discriminated
 * unions instead of throwing. Never throws when no account resolves.
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const account = await getCurrentAccount();
  return account?.role === "admin";
}

export async function getCurrentAccount(): Promise<AccountProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return resolveAccountProfile(supabase, user.id);
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
