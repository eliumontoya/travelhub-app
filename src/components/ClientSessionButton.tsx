import Link from "next/link";
import { getClientSession } from "@/lib/client-auth";
import { clientLogout } from "@/app/client/login/actions";

/**
 * Header icon that exposes the client login/logout entry point.
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
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 ${className}`}
      >
        🔐
      </Link>
    );
  }

  return (
    <form action={clientLogout}>
      <button
        type="submit"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 ${className}`}
      >
        🚪
      </button>
    </form>
  );
}
