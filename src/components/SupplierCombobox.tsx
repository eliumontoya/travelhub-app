"use client";

import { useMemo, useState } from "react";
import { Supplier } from "@/types";
import { CreateSupplierDialog } from "@/components/CreateSupplierDialog";

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function SupplierCombobox({
  suppliers,
  name,
  defaultValue,
  onSupplierSelected,
}: {
  suppliers: Supplier[];
  name: string;
  defaultValue?: string;
  onSupplierSelected?: (supplier: Supplier) => void;
}) {
  const defaultSupplier = defaultValue
    ? suppliers.find((s) => s.id === defaultValue)
    : undefined;
  const [query, setQuery] = useState(defaultSupplier?.name ?? "");
  const [selectedId, setSelectedId] = useState(defaultSupplier?.id ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>(suppliers);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const selectedSupplier = allSuppliers.find((s) => s.id === selectedId);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return allSuppliers.filter((s) => normalize(s.name).includes(q)).slice(0, 8);
  }, [allSuppliers, query]);

  function handleSelect(supplier: Supplier) {
    setQuery(supplier.name);
    setSelectedId(supplier.id);
    setIsOpen(false);
    onSupplierSelected?.(supplier);
  }

  function handleChange(value: string) {
    setQuery(value);
    setSelectedId("");
    setIsOpen(true);
  }

  function handleSupplierCreated(supplier: Supplier) {
    setAllSuppliers((prev) => [supplier, ...prev]);
    setQuery(supplier.name);
    setSelectedId(supplier.id);
    setIsOpen(false);
    onSupplierSelected?.(supplier);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="Buscar proveedor…"
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        autoComplete="off"
      />
      <input type="hidden" name={name} value={selectedId} />

      {isOpen && (
        <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-md">
          {results.length === 0 && query.trim() && (
            <li className="px-3 py-2 text-sm text-gray-400">
              Sin resultados
            </li>
          )}
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-medium">{s.name}</span>
                {s.address && (
                  <span className="ml-2 text-xs text-gray-400">{s.address}</span>
                )}
                {s.contactPhone && (
                  <span className="ml-2 text-xs text-gray-400">{s.contactPhone}</span>
                )}
              </button>
            </li>
          ))}
          <li className="border-t border-gray-100">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setShowCreateDialog(true);
              }}
              className="block w-full px-3 py-2 text-left text-sm font-medium text-blue-600 hover:bg-blue-50"
            >
              + Crear nuevo proveedor
            </button>
          </li>
        </ul>
      )}

      {/* Selected supplier details */}
      {selectedSupplier && !isOpen && (
        <div className="mt-1 text-xs text-gray-500">
          {selectedSupplier.address && <p>{selectedSupplier.address}</p>}
          {selectedSupplier.contactPhone && <p>{selectedSupplier.contactPhone}</p>}
        </div>
      )}

      <CreateSupplierDialog
        key={showCreateDialog ? "create-open" : "create-closed"}
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={handleSupplierCreated}
      />
    </div>
  );
}
