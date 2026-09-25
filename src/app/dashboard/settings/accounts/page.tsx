import { listProfiles } from "@/lib/data";
import { requireAdmin } from "@/lib/auth/roles";
import { FeatureManagerClient } from "./FeatureManagerClient";

// Server Component for the admin-only feature-management view. Not gated by
// the `settings` feature — admins reach this through their dedicated
// navigation entry (and the guard is purely role-based).
export default async function AccountsPage() {
  await requireAdmin();
  const profiles = await listProfiles();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Permisos por agente
      </h1>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        Asigna qué secciones del dashboard puede ver cada agente. Los cambios
        se reflejan al navegar de nuevo en cualquier sesión.
      </p>
      <FeatureManagerClient profiles={profiles} />
    </main>
  );
}
