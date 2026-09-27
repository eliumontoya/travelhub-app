"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type DashboardSidebarNavProps = {
  isAdmin: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Inicio", icon: "⌂" },
  { href: "/dashboard/trips", label: "Viajes", icon: "▢" },
  { href: "/dashboard/clients", label: "Clientes", icon: "◎" },
  { href: "/dashboard/suppliers", label: "Proveedores", icon: "▤" },
  { href: "/dashboard/travel-agents", label: "Agentes", icon: "◇", adminOnly: true },
  { href: "/dashboard/settings/accounts", label: "Cuentas", icon: "◌", adminOnly: true },
  { href: "/dashboard/wcc", label: "WhatsApp C.C.", icon: "ϟ", adminOnly: true },
  { href: "/dashboard/settings", label: "Ajustes", icon: "⚙", adminOnly: true },
];

function matchesPath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebarNav({ isAdmin }: DashboardSidebarNavProps) {
  const pathname = usePathname() || "/dashboard";
  const visibleItems = navItems.filter((item) => isAdmin || !item.adminOnly);
  const activeHref = visibleItems
    .filter((item) => matchesPath(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="space-y-2 text-sm font-semibold" aria-label="Navegación principal">
      {visibleItems.map((item) => {
        const active = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "flex items-center gap-3 rounded-xl bg-white/12 px-4 py-3.5 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] transition hover:bg-white/18"
                : "flex items-center gap-3 rounded-xl px-4 py-3.5 text-white/88 transition hover:bg-white/12"
            }
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
