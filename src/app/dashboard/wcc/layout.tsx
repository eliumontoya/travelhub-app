import Link from "next/link";
import { WccNavLink } from "./nav-link";

const wccNav = [
  { href: "/dashboard/wcc", label: "Dashboard" },
  { href: "/dashboard/wcc/contacts", label: "Contactos" },
  { href: "/dashboard/wcc/conversations", label: "Conversaciones" },
  { href: "/dashboard/wcc/escalations", label: "Escalaciones" },
  { href: "/dashboard/wcc/knowledge", label: "Knowledge" },
];

export default function WccLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-57px)] bg-slate-950 text-slate-100">
      <header className="border-b border-emerald-900/60 bg-slate-950/95">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-700 px-3 py-1 text-sm font-semibold text-slate-200 hover:border-emerald-400 hover:text-emerald-200"
            >
              ← TravelHub
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">WhatsApp C.C.</p>
              <h1 className="text-xl font-bold text-white">Command Control</h1>
            </div>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm" aria-label="WhatsApp Command Control">
            {wccNav.map((item) => (
              <WccNavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
