import Link from "next/link";
import { ProfileMenu } from "@/components/ProfileMenu";
import { ChangelogDialog } from "@/components/ChangelogDialog";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOutAction } from "@/app/dashboard/settings/actions";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  canAccessFeature,
  getCurrentAccount,
  resolveMockAccountId,
} from "@/lib/auth/roles";
import { FEATURE_DEFINITIONS } from "@/lib/auth/features";
import { ALL_CLIENTS_PAGE_SIZE, ALL_TRIPS_PAGE_SIZE, getClients, getTripsWithClients } from "@/lib/data";
import { getChangelog } from "@/lib/changelog";

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

  const account = await getCurrentAccount(await resolveMockAccountId());

  const changelog = getChangelog();

  const [{ items: clients }, { items: trips }] = await Promise.all([
    getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE }),
    getTripsWithClients({ pageSize: ALL_TRIPS_PAGE_SIZE }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              TravelHub
            </Link>
            <nav className="hidden sm:flex items-center gap-3 text-sm">
              {/* Dashboard home is unconditional for every authenticated account. */}
              <Link
                href="/dashboard"
                className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                Dashboard
              </Link>
              {/* Each feature link renders only when the current account can access it. */}
              {FEATURE_DEFINITIONS.map((def) =>
                canAccessFeature(account, def.feature) ? (
                  <Link
                    key={def.feature}
                    href={def.href}
                    className={
                      def.feature === "whatsapp"
                        ? "rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
                        : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    }
                  >
                    {def.label}
                  </Link>
                ) : null,
              )}
              {/* Admin-only link: account management edits the feature flags, it is not a flag itself. */}
              {account?.role === "admin" ? (
                <Link
                  href="/dashboard/settings/accounts"
                  className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                >
                  Cuentas
                </Link>
              ) : null}
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
