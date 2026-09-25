"use server";

import { revalidatePath } from "next/cache";
import {
  getCurrentAccount,
  resolveMockAccountId,
} from "@/lib/auth/roles";
import { updateProfileFeatures } from "@/lib/data/profiles";
import type { Feature } from "@/types";

const ACCOUNTS_PATH = "/dashboard/settings/accounts";

/**
 * Server action backing the admin feature-toggle UI.
 *
 * Authorization is double-checked here even though the page is guarded by
 * `requireAdmin`: server actions are reachable from any client bundle and must
 * not trust the caller. RLS (`profiles_admin_update_features`) is the
 * authoritative enforcement in Supabase mode; this check is defense in depth
 * and the only enforcement in mock mode.
 *
 * Returns a discriminated union so the client component can render an inline
 * error without throwing (server actions throw to a global error boundary,
 * which we do not want for "no autorizado").
 */
export async function updateProfileFeaturesAction(
  profileId: string,
  features: Feature[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const account = await getCurrentAccount(await resolveMockAccountId());
  if (account?.role !== "admin") {
    return { ok: false, error: "No autorizado." };
  }

  try {
    await updateProfileFeatures(profileId, features);
    revalidatePath(ACCOUNTS_PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "Error al guardar los permisos." };
  }
}
