import Link from "next/link";
import type { ReactNode } from "react";
import { DEFAULT_PAGE_SIZE, getClientsWithTags } from "@/lib/data";
import { ClientsExplorer } from "./ClientsExplorer";

type SearchParamValue = string | string[] | undefined;
type ClientsPageSearchParams = Record<string, SearchParamValue>;

export default async function ClientsIndexPage({
  searchParams,
}: {
  searchParams: Promise<ClientsPageSearchParams>;
}) {
  const params = await searchParams;
  const page = parsePageParam(params.page);
  const { items: clients, totalCount } = await getClientsWithTags({ page, pageSize: DEFAULT_PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(totalCount / DEFAULT_PAGE_SIZE));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Clientes</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Clientes registrados</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Consulta datos de contacto, etiquetas e historial desde una vista dedicada.
          </p>
        </div>
        <Link
          href="/dashboard/trips/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
        >
          + Nuevo viaje
        </Link>
      </div>

      <ClientsExplorer clients={clients} totalCount={totalCount} />

      <ClientsPagination currentPage={page} totalPages={totalPages} />
    </main>
  );
}

function ClientsPagination({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) {
  return (
    <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Paginación de clientes">
      <PaginationLink page={currentPage - 1} disabled={currentPage <= 1}>
        ← Anterior
      </PaginationLink>
      <span className="text-gray-500 dark:text-gray-400">
        Página {currentPage} de {totalPages}
      </span>
      <PaginationLink page={currentPage + 1} disabled={currentPage >= totalPages}>
        Siguiente →
      </PaginationLink>
    </nav>
  );
}

function PaginationLink({
  page,
  disabled,
  children,
}: {
  page: number;
  disabled: boolean;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-300 dark:border-gray-800 dark:text-gray-600">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={page > 1 ? `/dashboard/clients?page=${page}` : "/dashboard/clients"}
      className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      {children}
    </Link>
  );
}

function firstParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePageParam(value: SearchParamValue) {
  const raw = firstParam(value);
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
