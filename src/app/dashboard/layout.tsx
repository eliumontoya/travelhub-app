import Link from "next/link";
import { cookies } from "next/headers";
import { ProfileMenu } from "@/components/ProfileMenu";
import { ChangelogDialog } from "@/components/ChangelogDialog";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOutAction } from "@/app/dashboard/settings/actions";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/roles";
import { ALL_CLIENTS_PAGE_SIZE, ALL_TRIPS_PAGE_SIZE, getClients, getTripsWithClients } from "@/lib/data";
import { getChangelog } from "@/lib/changelog";

const MOCK_ACCOUNT_COOKIE = "x-mock-account-id";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let email: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
  }

  const cookieStore = await cookies();
  const mockAccountId = cookieStore.get(MOCK_ACCOUNT_COOKIE)?.value;
  const role = await getCurrentUserRole(mockAccountId);
  const isAdmin = role === "admin";

  const changelog = getChangelog();

  const [{ items: clients }, { items: trips }] = await Promise.all([
    getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE }),
    getTripsWithClients({ pageSize: ALL_TRIPS_PAGE_SIZE }),
  ]);

  return (
    <div className="min-h-screen bg-[var(--operator-canvas)] text-[var(--operator-ink)]">
      <header className="border-b border-[var(--operator-border)] bg-[var(--operator-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-semibold tracking-[-0.02em] text-[var(--operator-brand)]">
              TravelHub
            </Link>
            <nav className="hidden sm:flex items-center gap-3 text-sm">
              <Link
                href="/dashboard"
                className="text-[var(--operator-ink-muted)] transition hover:text-[var(--operator-brand)]"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/trips"
                className="text-[var(--operator-ink-muted)] transition hover:text-[var(--operator-brand)]"
              >
                Viajes
              </Link>
              <Link
                href="/dashboard/clients"
                className="text-[var(--operator-ink-muted)] transition hover:text-[var(--operator-brand)]"
              >
                Clientes
              </Link>
              <Link
                href="/dashboard/suppliers"
                className="text-[var(--operator-ink-muted)] transition hover:text-[var(--operator-brand)]"
              >
                Proveedores
              </Link>
              {isAdmin && (
                <>
                  <Link
                    href="/dashboard/travel-agents"
                    className="text-[var(--operator-ink-muted)] transition hover:text-[var(--operator-brand)]"
                  >
                    Agentes
                  </Link>
                  <Link
                    href="/dashboard/settings/accounts"
                    className="text-[var(--operator-ink-muted)] transition hover:text-[var(--operator-brand)]"
                  >
                    Cuentas
                  </Link>
                  <Link
                    href="/dashboard/wcc"
                    className="rounded-full bg-[var(--operator-surface-subtle)] px-3 py-1 font-semibold text-[var(--operator-brand)] transition hover:bg-[var(--operator-surface-hover)]"
                  >
                    WhatsApp C.C.
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    className="text-[var(--operator-ink-muted)] transition hover:text-[var(--operator-brand)]"
                  >
                    Ajustes
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ChangelogDialog entries={changelog} />
            <ThemeToggle />
            <ProfileMenu email={email} signOutAction={signOutAction} />
          </div>
        </div>
      </header>
      <CommandPalette
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        trips={trips.map((t) => ({ id: t.id, title: t.title }))}
      />
      {children}
    </div>
  );
}
