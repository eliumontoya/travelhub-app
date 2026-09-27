"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Supplier } from "@/types";
import { CreateSupplierDialog } from "@/components/CreateSupplierDialog";
import { SupplierPlaceEnrichmentDialog } from "@/components/SupplierPlaceEnrichmentDialog";
import { SupplierGooglePlaceBadge } from "@/components/SupplierGooglePlaceBadge";
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
          className="min-w-0 flex-1 rounded-xl border border-[var(--operator-border)] bg-white px-4 py-2.5 text-sm text-[var(--operator-ink)] outline-none focus:border-[var(--operator-brand)] focus:ring-2 focus:ring-[var(--operator-brand)]/15"
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
          className="min-w-40 rounded-xl border border-[var(--operator-border)] bg-white px-4 py-2.5 text-sm text-[var(--operator-ink)] outline-none focus:border-[var(--operator-brand)] focus:ring-2 focus:ring-[var(--operator-brand)]/15"
        />
        <button
          type="button"
          onClick={() => applyFilters(searchText, currentType, tagText, 1)}
          className="rounded-xl border border-[var(--operator-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--operator-brand)] hover:bg-[var(--operator-surface-subtle)]"
        >
          Buscar
        </button>
        <select
          value={currentType}
          onChange={(e) => applyFilters(currentQuery, e.target.value, currentTag, 1)}
          className="rounded-xl border border-[var(--operator-border)] bg-white px-4 py-2.5 text-sm text-[var(--operator-ink)] outline-none focus:border-[var(--operator-brand)] focus:ring-2 focus:ring-[var(--operator-brand)]/15"
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
          className="rounded-xl bg-[var(--operator-brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--operator-shadow-action)] hover:bg-[var(--operator-brand-strong)]"
        >
          + Nuevo proveedor
        </button>
      </div>

      {/* Table */}
      {suppliers.length === 0 ? (
        <div className="rounded-2xl border border-[var(--operator-border)] bg-white/94 p-8 text-center shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
          <p className="text-[var(--operator-ink-muted)]">
            {currentQuery || currentType || currentTag
              ? "No se encontraron proveedores con esos filtros."
              : "Aún no hay proveedores. ¡Crea el primero!"}
          </p>
          {!currentQuery && !currentType && !currentTag && (
            <button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="mt-3 rounded-xl bg-[var(--operator-brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--operator-shadow-action)] hover:bg-[var(--operator-brand-strong)]"
            >
              Crear primer proveedor
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--operator-border)] bg-white/94 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--operator-surface-subtle)]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[var(--operator-ink-muted)]">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--operator-ink-muted)]">Tipo</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--operator-ink-muted)]">Teléfono</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--operator-ink-muted)]">Email</th>
                <th className="px-4 py-3 text-left font-medium text-[var(--operator-ink-muted)]">Tags</th>
                <th className="px-4 py-3 text-right font-medium text-[var(--operator-ink-muted)]">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--operator-border)]">
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-[var(--operator-surface-subtle)]">
                  <td className="px-4 py-3 font-semibold text-[var(--operator-brand)]">
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
                      <span>{supplier.name}</span>
                      <SupplierGooglePlaceBadge googlePlaceId={supplier.googlePlaceId} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--operator-ink-muted)]">
                    {supplier.type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </td>
                  <td className="px-4 py-3 text-[var(--operator-ink-muted)]">
                    {supplier.contactPhone || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--operator-ink-muted)]">
                    {supplier.contactEmail || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--operator-ink-muted)]">
                    {supplier.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {supplier.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-[var(--operator-surface-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--operator-brand)]">
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
                      className="mr-2 text-sm text-[var(--operator-brand)] hover:underline"
                    >
                      Completar desde Google
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSupplier(supplier)}
                      className="mr-2 text-sm text-[var(--operator-brand)] hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(supplier)}
                      className="text-sm text-[var(--operator-coral)] hover:underline"
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
              className="rounded-xl border border-[var(--operator-border)] bg-white px-3 py-1.5 text-sm text-[var(--operator-brand)] hover:bg-[var(--operator-surface-subtle)]"
            >
              Anterior
            </a>
          )}
          <span className="text-sm text-[var(--operator-ink-muted)]">
            Pág. {currentPage} de {totalPages}
          </span>
          {currentPage < totalPages && (
            <a
              href={buildPageUrl(currentPage + 1)}
              className="rounded-xl border border-[var(--operator-border)] bg-white px-3 py-1.5 text-sm text-[var(--operator-brand)] hover:bg-[var(--operator-surface-subtle)]"
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
