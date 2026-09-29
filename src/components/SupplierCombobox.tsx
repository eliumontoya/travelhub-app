"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Supplier } from "@/types";
import type { SupplierType } from "@/lib/constants";
import { CreateSupplierDialog } from "@/components/CreateSupplierDialog";

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getSupplierOptions(
  suppliers: Supplier[],
  requiredSupplierType: SupplierType,
  query: string,
) {
  const normalizedQuery = normalize(query.trim());
  return suppliers.filter(
    (supplier) =>
      supplier.type === requiredSupplierType &&
      (!normalizedQuery || normalize(supplier.name).includes(normalizedQuery)),
  );
}

type SupplierComboboxProps = {
  suppliers: Supplier[];
  name: string;
  requiredSupplierType?: SupplierType;
  value?: string;
  onChange?: (supplier: Supplier | null) => void;
  onSupplierCreated?: (supplier: Supplier) => void;
  defaultValue?: string;
  onSupplierSelected?: (supplier: Supplier) => void;
};

export function SupplierCombobox({
  suppliers,
  name,
  requiredSupplierType,
  value,
  onChange,
  onSupplierCreated,
  defaultValue,
  onSupplierSelected,
}: SupplierComboboxProps) {
  const listboxId = useId();
  const defaultSupplier = defaultValue ? suppliers.find((supplier) => supplier.id === defaultValue) : undefined;
  const [query, setQuery] = useState(defaultSupplier?.name ?? "");
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultSupplier?.id ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>(suppliers);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const skipQuerySync = useRef(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIndexRef = useRef(-1);
  const selectedValue = value ?? uncontrolledValue;
  const selectedSupplier = allSuppliers.find((supplier) => supplier.id === selectedValue);
  const results = useMemo(() => {
    if (requiredSupplierType) return getSupplierOptions(allSuppliers, requiredSupplierType, query);
    const normalizedQuery = normalize(query.trim());
    return allSuppliers.filter((supplier) => !normalizedQuery || normalize(supplier.name).includes(normalizedQuery));
  }, [allSuppliers, query, requiredSupplierType]);

  useEffect(() => {
    setAllSuppliers((current) => {
      const created = current.filter((supplier) => !suppliers.some(({ id }) => id === supplier.id));
      return [...created, ...suppliers];
    });
  }, [suppliers]);

  useEffect(() => {
    if (selectedSupplier) {
      setQuery(selectedSupplier.name);
    } else if (value !== undefined && !skipQuerySync.current) {
      setQuery("");
    }
    skipQuerySync.current = false;
  }, [selectedSupplier, selectedValue, value]);

  useEffect(() => {
    return () => {
      if (blurTimeout.current) clearTimeout(blurTimeout.current);
    };
  }, []);

  function open() {
    setIsOpen(true);
    activeIndexRef.current = -1;
    setActiveIndex(-1);
  }

  function handleFocus() {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    open();
  }

  function handleBlur() {
    blurTimeout.current = setTimeout(() => setIsOpen(false), 150);
  }

  function notifyChange(supplier: Supplier | null) {
    setUncontrolledValue(supplier?.id ?? "");
    onChange?.(supplier);
    if (supplier) onSupplierSelected?.(supplier);
  }

  function handleSelect(supplier: Supplier) {
    setQuery(supplier.name);
    setIsOpen(false);
    activeIndexRef.current = -1;
    setActiveIndex(-1);
    notifyChange(supplier);
  }

  function handleChange(nextQuery: string) {
    skipQuerySync.current = true;
    setQuery(nextQuery);
    activeIndexRef.current = -1;
    setActiveIndex(-1);
    setIsOpen(true);
    if (selectedValue) notifyChange(null);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      activeIndexRef.current = -1;
      setActiveIndex(-1);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) open();
      if (results.length === 0) return;
      const offset = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (activeIndexRef.current + offset + results.length) % results.length;
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selectedIndex = activeIndexRef.current;
      if (selectedIndex >= 0 && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  }

  function handleKeyPress(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.preventDefault();
  }

  function handleSupplierCreated(supplier: Supplier) {
    setAllSuppliers((current) => [supplier, ...current]);
    setQuery(supplier.name);
    setIsOpen(false);
    activeIndexRef.current = -1;
    setActiveIndex(-1);
    onSupplierCreated?.(supplier);
    notifyChange(supplier);
  }

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-label="Buscar proveedor"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${results[activeIndex]?.id}` : undefined}
        value={query}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onKeyPress={handleKeyPress}
        onBlur={handleBlur}
        placeholder="Buscar proveedor…"
        className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
        autoComplete="off"
      />
      <input type="hidden" name={name} value={selectedValue} />

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[var(--operator-border)] bg-white shadow-md"
        >
          {results.length === 0 && query.trim() && (
            <li className="px-3 py-2 text-sm text-[var(--operator-ink-subtle)]">Sin resultados</li>
          )}
          {results.map((supplier, index) => (
            <li key={supplier.id}>
              <button
                id={`${listboxId}-${supplier.id}`}
                type="button"
                role="option"
                aria-selected={supplier.id === selectedValue}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(supplier)}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-[var(--operator-canvas)] ${
                  index === activeIndex ? "bg-[var(--operator-canvas)]" : ""
                }`}
              >
                <span className="font-medium">{supplier.name}</span>
                {supplier.address && <span className="ml-2 text-xs text-[var(--operator-ink-subtle)]">{supplier.address}</span>}
                {supplier.contactPhone && <span className="ml-2 text-xs text-[var(--operator-ink-subtle)]">{supplier.contactPhone}</span>}
              </button>
            </li>
          ))}
          <li className="border-t border-[var(--operator-border)]">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setShowCreateDialog(true)}
              className="block w-full px-3 py-2 text-left text-sm font-medium text-[var(--operator-brand)] hover:bg-[var(--operator-surface-subtle)]"
            >
              + Crear nuevo proveedor
            </button>
          </li>
        </ul>
      )}

      {selectedSupplier && !isOpen && (
        <div className="mt-1 text-xs text-[var(--operator-ink-muted)]">
          {selectedSupplier.address && <p>{selectedSupplier.address}</p>}
          {selectedSupplier.contactPhone && <p>{selectedSupplier.contactPhone}</p>}
        </div>
      )}

      <CreateSupplierDialog
        key={showCreateDialog ? "create-open" : "create-closed"}
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={handleSupplierCreated}
        defaultType={requiredSupplierType}
      />
    </div>
  );
}
