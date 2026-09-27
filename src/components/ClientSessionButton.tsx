import Link from "next/link";
import { getClientSession } from "@/lib/client-auth";

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
        🔐
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
      🔐
    </Link>
  );
}
