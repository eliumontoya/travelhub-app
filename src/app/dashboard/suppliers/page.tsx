import { getSuppliers } from "@/lib/data";
import { SupplierCatalogClient } from "./catalog-client";
import { SUPPLIER_TYPES } from "@/lib/constants";

export default async function SupplierCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; type?: string; page?: string }>;
}) {
  const resolvedParams = await searchParams;
  const query = resolvedParams.query || "";
  const type = resolvedParams.type || "";
  const page = parseInt(resolvedParams.page || "1", 10);

  const { items: suppliers, totalCount } = await getSuppliers({
    query,
    type: type || undefined,
    page,
    pageSize: 20,
  });

  const totalPages = Math.ceil(totalCount / 20);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Proveedores</h1>
      </div>

      <SupplierCatalogClient
        suppliers={suppliers}
        supplierTypes={SUPPLIER_TYPES as unknown as string[]}
        currentQuery={query}
        currentType={type}
        currentPage={page}
        totalPages={totalPages}
      />
    </main>
  );
}
