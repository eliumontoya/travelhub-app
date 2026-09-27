"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function ProfileMenu({
  email,
  signOutAction,
}: {
  email: string | null;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menú de cuenta"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--operator-surface-subtle)] text-[var(--operator-ink-muted)] hover:bg-[var(--operator-border)] dark:bg-[var(--operator-brand)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand-strong)]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-5 w-5"
        >
          <path
            fillRule="evenodd"
            d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653Zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438ZM15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-[var(--operator-border)] bg-white p-2 shadow-lg dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand)]">
          <p className="truncate px-2 py-1.5 text-sm text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">
            {email ?? "Sesión sin autenticar"}
          </p>
          <Link
            href="/dashboard/settings"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-2 py-1.5 text-sm text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:text-[var(--operator-brand)] dark:hover:bg-[var(--operator-brand-strong)]"
          >
            Configuración
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-[var(--operator-coral)] hover:bg-[var(--operator-coral)]/10 dark:text-[var(--operator-coral)] dark:hover:bg-[var(--operator-coral)]/10"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
