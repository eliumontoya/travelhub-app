import Link from "next/link";
import { ProfileMenu } from "@/components/ProfileMenu";
import { signOutAction } from "@/app/dashboard/settings/actions";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-sm font-semibold text-gray-900">
            TravelHub
          </Link>
          <ProfileMenu email={email} signOutAction={signOutAction} />
        </div>
      </header>
      {children}
    </div>
  );
}
