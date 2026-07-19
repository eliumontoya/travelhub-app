import Link from "next/link";
import { ProfileMenu } from "@/components/ProfileMenu";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOutAction } from "@/app/dashboard/settings/actions";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { ALL_CLIENTS_PAGE_SIZE, ALL_TRIPS_PAGE_SIZE, getClients, getTripsWithClients } from "@/lib/data";

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

  const [{ items: clients }, { items: trips }] = await Promise.all([
    getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE }),
    getTripsWithClients({ pageSize: ALL_TRIPS_PAGE_SIZE }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            TravelHub
          </Link>
          <div className="flex items-center gap-2">
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
