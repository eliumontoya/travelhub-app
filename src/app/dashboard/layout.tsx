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
    <div data-testid="dashboard-hubit-shell" className="min-h-screen bg-[#f8f7fa] text-[var(--operator-ink)] lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="hidden bg-[linear-gradient(180deg,#610039,#360024)] px-4 py-7 text-white lg:flex lg:min-h-screen lg:flex-col">
        <Link href="/dashboard" className="mb-9 flex items-center" aria-label="HUBit dashboard">
          <Image src="/hubit-logo-transparent.png" alt="HUBit by TravelHub" width={728} height={282} className="h-12 w-auto object-contain" />
        </Link>
        <nav className="space-y-2 text-sm font-semibold">
          <Link href="/dashboard" className="flex items-center gap-3 rounded-xl bg-white/12 px-4 py-3.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition hover:bg-white/18"><span aria-hidden="true">⌂</span>Inicio</Link>
          <Link href="/dashboard/trips" className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-white/88 transition hover:bg-white/12"><span aria-hidden="true">▢</span>Viajes</Link>
          <Link href="/dashboard/clients" className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-white/88 transition hover:bg-white/12"><span aria-hidden="true">◎</span>Clientes</Link>
          <Link href="/dashboard/suppliers" className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-white/88 transition hover:bg-white/12"><span aria-hidden="true">▤</span>Proveedores</Link>
          {isAdmin && <Link href="/dashboard/travel-agents" className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-white/88 transition hover:bg-white/12"><span aria-hidden="true">◇</span>Agentes</Link>}
          {isAdmin && <Link href="/dashboard/settings/accounts" className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-white/88 transition hover:bg-white/12"><span aria-hidden="true">◌</span>Cuentas</Link>}
          {isAdmin && <Link href="/dashboard/wcc" className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-white/88 transition hover:bg-white/12"><span aria-hidden="true">ϟ</span>WhatsApp C.C.</Link>}
          {isAdmin && <Link href="/dashboard/settings" className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-white/88 transition hover:bg-white/12"><span aria-hidden="true">⚙</span>Ajustes</Link>}
        </nav>
        <div className="mt-auto space-y-4 border-t border-white/15 pt-5">
          <ChangelogDialog entries={changelog} />
          <Link href="/" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white/88 transition hover:bg-white/12">← Volver al sitio</Link>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="border-b border-[var(--operator-border)] bg-white/88 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-7">
            <Link href="/dashboard" className="flex items-center lg:hidden" aria-label="HUBit dashboard">
              <Image src="/hubit-logo-transparent.png" alt="HUBit by TravelHub" width={728} height={282} className="h-8 w-auto object-contain" />
            </Link>
            <nav className="hidden items-center gap-3 text-sm sm:flex lg:hidden">
              <Link href="/dashboard" className="text-[var(--operator-ink-muted)] transition hover:text-[var(--operator-brand)]">Dashboard</Link>
              <Link href="/dashboard/trips" className="text-[var(--operator-ink-muted)] transition hover:text-[var(--operator-brand)]">Viajes</Link>
              <Link href="/dashboard/clients" className="text-[var(--operator-ink-muted)] transition hover:text-[var(--operator-brand)]">Clientes</Link>
            </nav>
            <div className="hidden min-w-0 max-w-3xl flex-1 items-center rounded-full border border-[var(--operator-border)] bg-[#f5f3f6] px-4 py-2.5 text-sm text-[var(--operator-ink-muted)] lg:flex">
              <span aria-hidden="true" className="mr-2">⌕</span> Buscar viajeros, viajes o documentos...
            </div>
            <div className="ml-auto flex items-center gap-2"><ThemeToggle /><ProfileMenu email={email} signOutAction={signOutAction} /></div>
          </div>
        </header>
        <CommandPalette clients={clients.map((c) => ({ id: c.id, name: c.name }))} trips={trips.map((t) => ({ id: t.id, title: t.title }))} />
        {children}
      </div>
    </div>
  );
}
