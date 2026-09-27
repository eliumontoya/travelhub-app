import { getSuppliers } from "@/lib/data";
import { SupplierCatalogClient } from "./catalog-client";
import { SUPPLIER_TYPES } from "@/lib/constants";
import { requireFeature } from "@/lib/auth/roles";

export default async function SupplierCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; type?: string; tag?: string; page?: string }>;
}) {
  await requireFeature("suppliers");
  const resolvedParams = await searchParams;
  const query = resolvedParams.query || "";
  const type = resolvedParams.type || "";
  const tag = resolvedParams.tag || "";
  const page = parseInt(resolvedParams.page || "1", 10);

  const { items: suppliers, totalCount } = await getSuppliers({
    query,
    type: type || undefined,
    tag: tag || undefined,
    page,
    pageSize: 20,
  });

  const totalPages = Math.ceil(totalCount / 20);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <section className="mb-7 overflow-hidden rounded-2xl bg-[var(--operator-brand)] px-5 py-6 text-white shadow-[var(--operator-shadow-panel)] sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Catálogo operativo</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Proveedores</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/82">Hoteles, transportes y servicios listos para armar itinerarios con el sistema HUBit.</p>
      </section>

      <SupplierCatalogClient
        suppliers={suppliers}
        supplierTypes={SUPPLIER_TYPES as unknown as string[]}
        currentQuery={query}
        currentType={type}
        currentTag={tag}
        currentPage={page}
        totalPages={totalPages}
      />
    </main>
  );
}
