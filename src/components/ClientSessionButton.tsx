import Link from "next/link";
import { getClientSession } from "@/lib/client-auth";

function TravelerAccountIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653Zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438ZM15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Header icon that exposes the client account entry point.
 * It does NOT gate the page; it only reflects the current session state.
 */
export async function ClientSessionButton({
  returnTo,
  className = "",
}: {
  returnTo?: string;
  className?: string;
}) {
  const session = await getClientSession();
  const loginHref = returnTo
    ? `/client/login?redirectTo=${encodeURIComponent(returnTo)}`
    : "/client/login";

  if (!session) {
    return (
      <Link
        href={loginHref}
        aria-label="Iniciar sesión"
        title="Iniciar sesión"
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-[var(--operator-surface-subtle)] text-[var(--operator-ink-muted)] hover:bg-[var(--operator-border)] dark:bg-[var(--operator-brand)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand-strong)] ${className}`}
      >
        <TravelerAccountIcon />
      </Link>
    );
  }

  return (
    <Link
      href="/client"
      aria-label="Ir a mi cuenta"
      title="Ir a mi cuenta"
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-[var(--operator-surface-subtle)] text-[var(--operator-ink-muted)] hover:bg-[var(--operator-border)] dark:bg-[var(--operator-brand)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand-strong)] ${className}`}
    >
      <TravelerAccountIcon />
    </Link>
  );
}
