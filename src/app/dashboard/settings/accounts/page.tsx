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
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <section className="mb-7 overflow-hidden rounded-2xl bg-[var(--operator-brand)] px-5 py-6 text-white shadow-[var(--operator-shadow-panel)] sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Administración</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Permisos por agente</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/82">Asigna qué secciones del dashboard puede ver cada agente. Los cambios se reflejan al navegar de nuevo en cualquier sesión.</p>
      </section>
      <FeatureManagerClient profiles={profiles} />
    </main>
  );
}
