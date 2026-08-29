"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function WccNavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = href === "/dashboard/wcc" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={
        isActive
          ? "rounded-full bg-emerald-400 px-3 py-1.5 font-semibold text-slate-950"
          : "rounded-full border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-slate-500 hover:text-white"
      }
    >
      {label}
    </Link>
  );
}
