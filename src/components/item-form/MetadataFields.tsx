"use client";

import { Item, ItemType } from "@/types";
import { itemTypeMeta } from "@/lib/item-meta";
import { ItemTypeIcon } from "@/components/ItemTypeIcon";
import { metadataDefaultValue, metadataFieldsByType } from "@/lib/item-form-fields";

export function MetadataFields({
  type,
  item,
  metadataAutofill,
  autofillVersion,
}: {
  type: ItemType;
  item?: Item;
  metadataAutofill: Record<string, string>;
  autofillVersion: number;
}) {
  const fields = metadataFieldsByType[type];

  if (type === "note" || fields.length === 0) return null;

  return (
    <div key={`${type}-${autofillVersion}`} className="border-t border-[var(--operator-border)] pt-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--operator-brand)]">
        <ItemTypeIcon type={type} title={itemTypeMeta[type].label} className="h-8 w-8" />
        <span>Detalles de {itemTypeMeta[type].label.toLowerCase()}</span>
      </h4>
      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-[var(--operator-ink)]">{field.label}</label>
            {field.type === "textarea" ? (
              <textarea
                name={`metadata_${field.name}`}
                defaultValue={metadataAutofill[field.name] ?? metadataDefaultValue(item, field.name)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
              />
            ) : field.type === "select" && field.options ? (
              <select
                name={`metadata_${field.name}`}
                defaultValue={metadataAutofill[field.name] ?? metadataDefaultValue(item, field.name) ?? ""}
                className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
              >
                <option value="">Seleccionar...</option>
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type}
                name={`metadata_${field.name}`}
                defaultValue={metadataAutofill[field.name] ?? metadataDefaultValue(item, field.name)}
                className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
