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
          ? "rounded-full bg-[var(--operator-gold)] px-3 py-1.5 font-semibold text-[var(--operator-brand)]"
          : "rounded-full border border-[var(--operator-border)] px-3 py-1.5 text-[var(--operator-ink-muted)] hover:border-[var(--operator-brand)] hover:text-[var(--operator-brand)]"
      }
    >
      {label}
    </Link>
  );
}
