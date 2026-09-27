import Link from "next/link";
import type { ReactNode } from "react";
import { DEFAULT_PAGE_SIZE, getClientsWithTags } from "@/lib/data";
import { requireFeature } from "@/lib/auth/roles";
import { ClientsExplorer } from "./ClientsExplorer";

type SearchParamValue = string | string[] | undefined;
type ClientsPageSearchParams = Record<string, SearchParamValue>;

export default async function ClientsIndexPage({
  searchParams,
}: {
  searchParams: Promise<ClientsPageSearchParams>;
}) {
  await requireFeature("clients");
  const params = await searchParams;
  const page = parsePageParam(params.page);
  const { items: clients, totalCount } = await getClientsWithTags({ page, pageSize: DEFAULT_PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(totalCount / DEFAULT_PAGE_SIZE));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <section className="relative mb-7 overflow-hidden rounded-2xl bg-[var(--operator-brand)] px-5 py-6 text-white shadow-[var(--operator-shadow-panel)] sm:px-7 sm:py-7">
        <div aria-hidden="true" className="absolute inset-y-0 right-0 hidden w-2/5 bg-[radial-gradient(circle_at_75%_35%,rgba(255,173,24,0.34),transparent_12%),linear-gradient(135deg,transparent_15%,rgba(255,255,255,0.1)_15%,transparent_32%,rgba(37,16,27,0.28)_32%)] lg:block" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Clientes</p>
            <h1 className="mt-2 text-3xl font-serif font-semibold tracking-[-0.04em] text-white sm:text-4xl">Clientes registrados</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/85 sm:text-base">
              Consulta datos de contacto, etiquetas e historial desde una vista dedicada.
            </p>
            <p className="mt-5 text-sm font-semibold text-[var(--operator-gold)]">{totalCount} cliente{totalCount !== 1 ? "s" : ""} en esta vista</p>
          </div>
          <Link href="/dashboard/trips/new" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 py-2.5 text-center text-sm font-semibold text-[var(--operator-brand)] shadow-[var(--operator-shadow-action)] transition hover:bg-[#fff4ed]">
            + Nuevo viaje
          </Link>
        </div>
      </section>

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
      <span className="text-[var(--operator-ink-muted)]">
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
      <span className="rounded-lg border border-[var(--operator-border)] px-3 py-1.5 text-[var(--operator-ink-subtle)]">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={page > 1 ? `/dashboard/clients?page=${page}` : "/dashboard/clients"}
      className="rounded-lg border border-[var(--operator-border)] bg-white px-3 py-1.5 text-[var(--operator-brand)] hover:bg-[var(--operator-surface-subtle)]"
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
