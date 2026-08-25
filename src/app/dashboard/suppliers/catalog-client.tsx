"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Supplier } from "@/types";
import { CreateSupplierDialog } from "@/components/CreateSupplierDialog";
import { SupplierPlaceEnrichmentDialog } from "@/components/SupplierPlaceEnrichmentDialog";
import { showUndoToast } from "@/components/UndoToast";
import {
  softDeleteSupplierAction,
  forceDeleteSupplierAction,
  restoreSupplierAction,
} from "./actions";

export function SupplierCatalogClient({
  suppliers,
  supplierTypes,
  currentQuery,
  currentType,
  currentTag,
  currentPage,
  totalPages,
}: {
  suppliers: Supplier[];
  supplierTypes: string[];
  currentQuery: string;
  currentType: string;
  currentTag: string;
  currentPage: number;
  totalPages: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [enrichingSupplier, setEnrichingSupplier] = useState<Supplier | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchText, setSearchText] = useState(currentQuery);
  const [tagText, setTagText] = useState(currentTag);

  function applyFilters(query: string, type: string, tag: string, page: number) {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (type) params.set("type", type);
    if (tag) params.set("tag", tag);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    startTransition(() => {
      router.push(`/dashboard/suppliers${qs ? `?${qs}` : ""}`);
    });
  }

  function handleDelete(supplier: Supplier) {
    if (!confirm(`¿Eliminar "${supplier.name}"?`)) return;
    startTransition(async () => {
      const result = await softDeleteSupplierAction(supplier.id);
      if (!result.ok) {
        if (result.itemCount && result.itemCount > 0) {
          const force = confirm(
            `Este proveedor está referenciado por ${result.itemCount} item(s). ¿Forzar eliminación (se perderá la referencia en esos items)?`
          );
          if (!force) return;
          const forceResult = await forceDeleteSupplierAction(supplier.id);
          if (!forceResult.ok) {
            alert(forceResult.error || "Error al eliminar");
            return;
          }
        } else {
          alert(result.error || "Error al eliminar");
          return;
        }
      }
      router.refresh();
      showUndoToast({
        message: "Proveedor eliminado",
        onUndo: async () => {
          await restoreSupplierAction(supplier.id);
          router.refresh();
        },
      });
    });
  }

  function buildPageUrl(page: number): string {
    const params = new URLSearchParams();
    if (currentQuery) params.set("query", currentQuery);
    if (currentType) params.set("type", currentType);
    if (currentTag) params.set("tag", currentTag);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/dashboard/suppliers${qs ? `?${qs}` : ""}`;
  }

  return (
    <div>
      {/* Search + filter bar */}
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              applyFilters(searchText, currentType, tagText, 1);
            }
          }}
          placeholder="Buscar por nombre…"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <input
          type="text"
          value={tagText}
          onChange={(e) => setTagText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              applyFilters(searchText, currentType, tagText, 1);
            }
          }}
          placeholder="Filtrar por tag…"
          className="min-w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={() => applyFilters(searchText, currentType, tagText, 1)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
        >
          Buscar
        </button>
        <select
          value={currentType}
          onChange={(e) => applyFilters(currentQuery, e.target.value, currentTag, 1)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">Todos los tipos</option>
          {supplierTypes.map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowCreateDialog(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nuevo proveedor
        </button>
      </div>

      {/* Table */}
      {suppliers.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-gray-500 dark:text-gray-400">
            {currentQuery || currentType || currentTag
              ? "No se encontraron proveedores con esos filtros."
              : "Aún no hay proveedores. ¡Crea el primero!"}
          </p>
          {!currentQuery && !currentType && !currentTag && (
            <button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Crear primer proveedor
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Teléfono</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Tags</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    {supplier.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {supplier.type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {supplier.contactPhone || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {supplier.contactEmail || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {supplier.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {supplier.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEnrichingSupplier(supplier)}
                      className="mr-2 text-sm text-blue-600 hover:underline"
                    >
                      Completar desde Google
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSupplier(supplier)}
                      className="mr-2 text-sm text-blue-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(supplier)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <a
              href={buildPageUrl(currentPage - 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
            >
              Anterior
            </a>
          )}
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Pág. {currentPage} de {totalPages}
          </span>
          {currentPage < totalPages && (
            <a
              href={buildPageUrl(currentPage + 1)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
            >
              Siguiente
            </a>
          )}
        </div>
      )}

      {/* Create dialog */}
      <CreateSupplierDialog
        key={showCreateDialog ? "create-open" : "create-closed"}
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={() => {
          setShowCreateDialog(false);
          router.refresh();
        }}
      />

      {/* Enrichment dialog */}
      {enrichingSupplier && (
        <SupplierPlaceEnrichmentDialog
          key={enrichingSupplier.id}
          open={enrichingSupplier !== null}
          supplier={enrichingSupplier}
          onClose={() => setEnrichingSupplier(null)}
          onUpdated={() => {
            setEnrichingSupplier(null);
            router.refresh();
          }}
        />
      )}

      {/* Edit dialog */}
      <CreateSupplierDialog
        key={editingSupplier?.id ?? "edit-closed"}
        open={editingSupplier !== null}
        supplier={editingSupplier ?? undefined}
        onClose={() => setEditingSupplier(null)}
        onCreated={() => {
          setEditingSupplier(null);
          router.refresh();
        }}
        onUpdated={() => {
          setEditingSupplier(null);
          router.refresh();
        }}
      />
    </div>
  );
}
