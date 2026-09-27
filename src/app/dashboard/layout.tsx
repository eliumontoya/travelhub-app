import Image from "next/image";
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
    <div data-testid="dashboard-hubit-shell" className="min-h-screen bg-[var(--operator-canvas)] text-[var(--operator-ink)] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden bg-[linear-gradient(180deg,var(--operator-brand-strong),#31001e)] px-4 py-6 text-white lg:flex lg:min-h-screen lg:flex-col">
        <Link href="/dashboard" className="mb-10 flex items-center" aria-label="HUBit dashboard">
          <Image src="/logo-transparent.png" alt="HUBit by TravelHub" width={2017} height={780} className="h-11 w-auto brightness-0 invert" />
        </Link>
        <nav className="space-y-1 text-sm font-medium">
          <Link href="/dashboard" className="block rounded-[var(--operator-radius-control)] bg-white/12 px-3 py-3 transition hover:bg-white/18">Inicio</Link>
          <Link href="/dashboard/trips" className="block rounded-[var(--operator-radius-control)] px-3 py-3 transition hover:bg-white/12">Viajes</Link>
          <Link href="/dashboard/clients" className="block rounded-[var(--operator-radius-control)] px-3 py-3 transition hover:bg-white/12">Clientes</Link>
          <Link href="/dashboard/suppliers" className="block rounded-[var(--operator-radius-control)] px-3 py-3 transition hover:bg-white/12">Proveedores</Link>
          {isAdmin && <Link href="/dashboard/travel-agents" className="block rounded-[var(--operator-radius-control)] px-3 py-3 transition hover:bg-white/12">Agentes</Link>}
          {isAdmin && <Link href="/dashboard/settings/accounts" className="block rounded-[var(--operator-radius-control)] px-3 py-3 transition hover:bg-white/12">Cuentas</Link>}
          {isAdmin && <Link href="/dashboard/wcc" className="block rounded-[var(--operator-radius-control)] px-3 py-3 transition hover:bg-white/12">WhatsApp C.C.</Link>}
          {isAdmin && <Link href="/dashboard/settings" className="block rounded-[var(--operator-radius-control)] px-3 py-3 transition hover:bg-white/12">Ajustes</Link>}
        </nav>
        <div className="mt-auto border-t border-white/15 pt-4"><ChangelogDialog entries={changelog} /></div>
      </aside>
      <div className="min-w-0">
        <header className="border-b border-[var(--operator-border)] bg-[var(--operator-surface)]/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/dashboard" className="flex items-center lg:hidden" aria-label="HUBit dashboard">
              <Image src="/logo-transparent.png" alt="HUBit by TravelHub" width={2017} height={780} className="h-8 w-auto object-contain" />
            </Link>
            <nav className="hidden items-center gap-3 text-sm sm:flex lg:hidden">
              <Link href="/dashboard" className="text-[var(--operator-ink-muted)] transition hover:text-[var(--operator-brand)]">Dashboard</Link>
              <Link href="/dashboard/trips" className="text-[var(--operator-ink-muted)] transition hover:text-[var(--operator-brand)]">Viajes</Link>
              <Link href="/dashboard/clients" className="text-[var(--operator-ink-muted)] transition hover:text-[var(--operator-brand)]">Clientes</Link>
            </nav>
            <div className="ml-auto flex items-center gap-2"><ThemeToggle /><ProfileMenu email={email} signOutAction={signOutAction} /></div>
          </div>
        </header>
        <CommandPalette clients={clients.map((c) => ({ id: c.id, name: c.name }))} trips={trips.map((t) => ({ id: t.id, title: t.title }))} />
        {children}
      </div>
    </div>
  );
}
