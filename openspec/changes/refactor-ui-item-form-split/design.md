# Design: Split `ItemFormDialog` into modular item-form pieces

## Technical Approach

Reduce `src/components/ItemFormDialog.tsx` (592 lines) to an orchestrator under ~300 lines by extracting three things along seams that already exist in the file:

1. **The schema + helpers** leave the client component and land in a `src/lib/` module, where the rest of the item UI schema already lives (`item-meta.ts`, `item-metadata-schemas.ts`). This makes the schema testable without a DOM.
2. **The data-driven metadata renderer** becomes one generic subcomponent, not six per-type components. The original render is already a single loop keyed by `${selectedType}-${metadataAutofillVersion}`; the extraction preserves that loop and that key.
3. **The documents section** becomes a self-contained presentational subcomponent with the callbacks and state it needs.

The dialog keeps ownership of all state and side effects (type, supplier, title, location, lat/lng, autofill, docs, upload error, pending, submit/delete). Subcomponents are presentational and receive props plus callbacks, so behavior is unchanged. `strict_tdd` applies to the schema move: a new unit test is written first against the current inlined field sets, observed RED, then made GREEN by moving the exact same schema into the lib module.

## Architecture Decisions

### Decision: Move the field schema to `src/lib/item-form-fields.ts` (D1)

**Choice**: `fieldName`/`FieldDef` type, `metadataFieldsByType`, `metadataDefaultValue`, and `appendSerializedMetadata` live in a new `src/lib/item-form-fields.ts`.

**Alternatives considered**:
- *Keep the schema in the component and only extract JSX* — rejected: the schema is data, not view, and keeping it in a `"use client"` module makes it harder to unit-test and to reuse. It also does not reduce the coupling that makes the file hard to review.
- *Create one `src/lib/item-form-fields.ts` per item type* — rejected: `metadataFieldsByType` is deliberately one `Record<ItemType, FieldDef[]>`; splitting it duplicates the schema surface and the tests.
- *Leave the schema in `ItemFormDialog.tsx` but export it* — rejected: exporting UI data from a client component is exactly the coupling this change removes.

**Rationale**: The repo already has the precedent `src/lib/item-meta.ts` (labels/icons per item type) and `src/lib/item-metadata-schemas.ts` (per-type zod schemas with tests). Putting the editable-field schema next to them is consistent and lets `item-form-fields.test.ts` pin it deterministically.

### Decision: Move `appendSerializedMetadata` to lib and re-export it from the dialog (D2)

**Choice**: `appendSerializedMetadata` moves into `src/lib/item-form-fields.ts`; `ItemFormDialog.tsx` re-exports it (`export { appendSerializedMetadata } from "@/lib/item-form-fields";`).

**Alternatives considered**:
- *Update `structured-items.test.ts:81` to import from the new module* — rejected: the task is a pure refactor with no behavior change; keeping the public import path stable avoids touching an unrelated test and preserves any other consumer of `@/components/ItemFormDialog`.
- *Duplicate the helper in both places* — rejected: divergence risk with no benefit.

**Rationale**: `appendSerializedMetadata` is the only module-level function of the dialog consumed elsewhere. A re-export keeps the existing contract (`@/components/ItemFormDialog`) valid while the implementation lives with the schema it reads.

### Decision: One generic data-driven `MetadataFields`, not per-type components (D3)

**Choice**: A single `src/components/item-form/MetadataFields.tsx` receives `type`, `item`, `metadataAutofill`, and `autofillVersion`, and renders the same loop the dialog renders today.

**Alternatives considered**:
- *Six per-type components (`FlightFields`, `HotelFields`, …)* — rejected: the current UI is fully data-driven from `metadataFieldsByType`. Six components would duplicate the identical loop six times and multiply the files to keep under budget, without reducing real complexity.
- *A render-prop / hook instead of a component* — rejected: a component is the smallest change that yields a reviewable seam; a hook would still leave the JSX in the dialog.

**Rationale**: The data-driven loop is the abstraction. The correct extraction is to move that loop, not to explode the data into code.

### Decision: Preserve the exact remount key semantics (D4)

**Choice**: `MetadataFields` reproduces the remount expression exactly as `${type}-${autofillVersion}` on its keyed root wrapper (equivalently, the dialog may apply `key={`${selectedType}-${metadataAutofillVersion}`}` at the call site). The expression, its inputs, and when it changes are unchanged from the current `:462`.

**Alternatives considered**:
- *Drop the key and switch the inputs to controlled components* — rejected: that is a behavior/implementation change well beyond a pure refactor, and it would alter uncontrolled-input semantics.
- *Key the whole `<form>`* — rejected: it would remount type/supplier/title inputs and reset unrelated state.

**Rationale**: The metadata inputs are uncontrolled and use `defaultValue`. The key forces React to recreate those inputs when the selected type changes or supplier autofill bumps the version, so `defaultValue` re-applies. Removing or moving the key changes observable behavior. The `supplier-item-compatibility` e2e spec is the behavioral net for this path.

### Decision: Extract the documents section as `ItemDocumentsSection` (D5)

**Choice**: `src/components/item-form/ItemDocumentsSection.tsx` owns the documents list, `DocumentPreview`, the upload error, the file input, and the upload/delete buttons. It receives `docs`, `docsLoading`, `uploadError`, `documentsEnabled`, `isPending`, the `fileInputRef`, and `onUpload` / `onDeleteDocument` callbacks. It renders only when an item exists (`item` truthy / an `open`/`visible` prop).

**Alternatives considered**:
- *Keep documents inline and extract only the metadata block* — rejected: the documents section is ~80 lines of self-contained UI and is the second-largest seam; keeping it leaves the dialog above budget.
- *Move `DocumentPreview` into its own file* — rejected: it is used only by this section; a private helper in the same file keeps the file count down and stays well under budget.

**Rationale**: The section already depends only on the dialog's `docs`/upload state and two callbacks; it is a clean presentational seam with no additional state.

### Decision: Strict TDD on the schema via a pin test (D6)

**Choice**: Add `src/lib/__tests__/item-form-fields.test.ts` first. It imports from `@/lib/item-form-fields` and pins, per type, the ordered field names, `required` flags, and option values/labels (`hotel.boardBasis`), plus `note` being empty. It also re-tests the serialization contract currently covered by `structured-items.test.ts` (trim, drop-empty, `null` when empty, shared `bookingReference` preserved). Run `npm run test` → RED (module missing) → move the schema verbatim → GREEN.

**Alternatives considered**:
- *Test after the move* — rejected: without a RED-first pin, a transcription error in the move would be invisible.
- *Only rely on `structured-items.test.ts`* — rejected: it covers serialization but not the per-type field sets, options, or `required` flags.

**Rationale**: `strict_tdd: true` in `openspec/config.yaml`. A deterministic Vitest unit test with a clear expected outcome exists, so test-first applies; the "module missing" failure is a legitimate RED for a move-created module.

### Decision: File-size budget ~300 lines (D7)

**Choice**: `ItemFormDialog.tsx` and each new file must be under ~300 lines. The dialog is expected at roughly 240–290 lines after extraction.

**Alternatives considered**:
- *No budget* — rejected: the issue's whole point is to cap file size.
- *Hard 300-line gate in CI* — rejected: out of scope for this change; a `wc -l` verification task is enough.

**Rationale**: The issue requires no file to exceed ~300 lines. A measured budget keeps the refactor honest.

## Data Flow

### Before

```
page.tsx (call site)
   └─ <ItemFormDialog ...props />
        ├─ state: type, supplier, title, location, lat/lng, autofill, docs, pending, error
        ├─ metadataFieldsByType (inline, :27-117)
        ├─ appendSerializedMetadata (inline, :119-131)
        ├─ metadataDefaultValue (inline, :134-141)
        ├─ DocumentPreview (inline, :145-180)
        ├─ render: metadata loop keyed `${selectedType}-${metadataAutofillVersion}` (:461-519)
        └─ render: documents section (:521-570)
```

### After

```
src/lib/item-form-fields.ts
   ├─ FieldDef
   ├─ metadataFieldsByType
   ├─ metadataDefaultValue
   └─ appendSerializedMetadata

page.tsx (call site, unchanged)
   └─ <ItemFormDialog ...props />            (re-exports appendSerializedMetadata)
        ├─ state + handlers (unchanged ownership)
        ├─ <MetadataFields type item metadataAutofill autofillVersion />
        │     └─ keyed root `${type}-${autofillVersion}` → metadata loop
        └─ <ItemDocumentsSection docs docsLoading uploadError documentsEnabled
                                  isPending fileInputRef onUpload onDeleteDocument />
              └─ DocumentPreview + list + uploader
```

### Metadata serialization (on submit)

```
form submit
   └─ FormData(currentTarget)
      └─ appendSerializedMetadata(formData, selectedType)   [from @/lib/item-form-fields]
           ├─ for each field of metadataFieldsByType[selectedType]:
           │     read `metadata_${name}`, trim, keep non-empty
           │     delete `metadata_${name}`
           └─ formData.set("metadata", JSON.stringify(valuesOrNull))
```

No change to the serialized output; the values still come from the same `metadata_<name>` input names.

### Autofill / remount (unchanged)

```
supplier selected
   └─ handleSupplierSelected → setMetadataAutofill(nextMetadata)
                              → setMetadataAutofillVersion(v => v + 1)
        └─ <MetadataFields key/remount expression `${type}-${autofillVersion}`>
              └─ inputs recreated → defaultValue={metadataAutofill[name] ?? metadataDefaultValue(item, name)}
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/item-form-fields.ts` | Create | `FieldDef` type, `metadataFieldsByType` (`Record<ItemType, FieldDef[]>`, `note: []`), `metadataDefaultValue`, `appendSerializedMetadata`. Verbatim semantics from the dialog. |
| `src/lib/__tests__/item-form-fields.test.ts` | Create | RED-first pin: per-type ordered names, `required` flags, option values/labels, `note` empty, serialization contract. Triangulation: every UI field name is accepted by the matching zod schema. |
| `src/components/item-form/MetadataFields.tsx` | Create | `"use client"`; props `type`, `item`, `metadataAutofill`, `autofillVersion`; renders the keyed metadata block and the `ItemTypeIcon` header. |
| `src/components/item-form/ItemDocumentsSection.tsx` | Create | `"use client"`; props for docs state + callbacks; includes private `DocumentPreview` and the image/PDF/other branches. |
| `src/components/ItemFormDialog.tsx` | Modify | Remove the moved code; import from `@/lib/item-form-fields`; render the two subcomponents; re-export `appendSerializedMetadata`. Under ~300 lines. |
| `src/lib/__tests__/structured-items.test.ts` | Verify | No edit: import path `@/components/ItemFormDialog` must still resolve. |
| `src/app/dashboard/trips/[id]/page.tsx` | Verify | No edit: call sites `:449` and `:487` and the public props unchanged. |
| `architecture.md` | Modify/Verify | Add `item-form-fields.ts` to the `lib/` listing and `components/item-form/` to the components tree if those listings age. |
| `README.md` | Verify | Confirm the truth-source table needs no edit (technical → `architecture.md`). |

## Interfaces / Contracts

### `src/lib/item-form-fields.ts`

```ts
import { Item, ItemType } from "@/types";

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "time" | "date" | "select" | "textarea";
  options?: { value: string; label: string }[];
  required?: boolean;
};

/** Single source of truth for editable metadata per item type. `note` has no fields. */
export const metadataFieldsByType: Record<ItemType, FieldDef[]>;

/** Reads a string metadata value from an item, or undefined. */
export function metadataDefaultValue(item: Item | undefined, fieldName: string): string | undefined;

/** Trims `metadata_*` fields into `metadata` JSON (or null) and strips them from FormData. */
export function appendSerializedMetadata(formData: FormData, selectedType: ItemType): void;
```

### `src/components/item-form/MetadataFields.tsx`

```tsx
"use client";

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
}): React.ReactNode;
```

Contract: renders nothing when `type === "note"` or the type has no fields; otherwise renders a root wrapper keyed `${type}-${autofillVersion}` containing the schema-driven inputs with names `metadata_<field.name>`, labels, `required`, and (for selects) the "Seleccionar..." placeholder.

### `src/components/item-form/ItemDocumentsSection.tsx`

```tsx
"use client";

export function ItemDocumentsSection({
  docs,
  docsLoading,
  uploadError,
  documentsEnabled,
  isPending,
  fileInputRef,
  onUpload,
  onDeleteDocument,
}: {
  docs: DocWithUrl[];
  docsLoading: boolean;
  uploadError: string | null;
  documentsEnabled?: boolean;
  isPending: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUpload: () => void;
  onDeleteDocument: (documentId: string) => void;
}): React.ReactNode;
```

Contract: identical to today's documents block — "Cargando…" while loading, list with `DocumentPreview` + "Eliminar" per doc, uploader when `documentsEnabled`, fallback text otherwise. The parent still guards rendering with `{item && ...}`.

### `src/components/ItemFormDialog.tsx`

```tsx
export { appendSerializedMetadata } from "@/lib/item-form-fields";
```

The public props (`trigger`, `item`, `allSuppliers`, `onSubmit`, `onDelete`, `onUndoDelete`, `onLoadDocuments`, `onUploadDocument`, `onDeleteDocument`, `documentsEnabled`) are unchanged.

## Testing Strategy

`strict_tdd: true`: the schema move has a deterministic Vitest test with a clear expected outcome, so it is test-first.

| Step | What runs | Expected result |
|------|-----------|-----------------|
| RED | `npm run test` with `item-form-fields.test.ts` importing `@/lib/item-form-fields` before the module exists | Fails: module/exports not found (the pin test describes the current schema). |
| GREEN | Move the schema verbatim into `src/lib/item-form-fields.ts`, import it from the dialog, re-export `appendSerializedMetadata`; `npm run test` | `item-form-fields.test.ts` and `structured-items.test.ts` pass. |
| TRIANGULATE | `item-form-fields.test.ts` negative/alternate cases: `note` empty renders nothing; unknown/blank metadata dropped; every UI field name is accepted by the matching zod schema (`validateItemMetadata(type, allFields)`); non-string metadata → `undefined` from `metadataDefaultValue` | All pass; pins the boundary between the UI schema and the zod schema. |
| REFACTOR | Extract `MetadataFields` and `ItemDocumentsSection`, trim the dialog; re-run `npm run test` | Suite green; no assertion changes. |

| Layer | What it verifies | Approach |
|-------|------------------|----------|
| Unit | Per-type field sets, serialization contract, zod alignment | `src/lib/__tests__/item-form-fields.test.ts` (new) + existing `structured-items.test.ts` |
| Unit | `item-meta` / metadata schema behavior untouched | existing `item-meta.test.ts`, schema tests |
| E2E (local) | Supplier autofill + type switch + documents on the real form | `e2e/local/supplier-item-compatibility.spec.ts` and the local project suite |
| Type/build | No type or build regressions from the move | `npx tsc --noEmit`, `npm run build` |
| Size | Every resulting file under budget | `wc -l` over the four files |

## Threat Matrix

N/A — this change introduces no shell/CLI routing, subprocess execution, VCS/PR automation, executable classification, or process-integration edge. It is a static code move among `src/lib` and `src/components` modules, with no inputs, network calls, or execution surface. No matrix row applies and no RED tests are fabricated from it.

## Migration / Rollout

- **Data/schema**: no migrations. Nothing under `supabase/migrations/` or `supabase/seed.sql` changes.
- **Rollout**: single PR; the effect is internal only. No feature flag needed because behavior is unchanged.
- **Compatibility**: public props and the `@/components/ItemFormDialog` import path are preserved. `src/lib/data.ts` and Server Actions are untouched.
- **Rollback**: revert the commits; delete the three new files plus the new test; `ItemFormDialog.tsx` returns to its pre-refactor state.
- **Docs**: `architecture.md` is the technical source of truth; update it if the lib/components listing ages, and verify the `README.md` table in the same PR.

## Open Questions

- [ ] Should `metadataDefaultValue` be exported from the lib module, or kept private and reached only through `MetadataFields`? Proposed: export it (the new test can cover non-string metadata directly), but the dialog need not import it once `MetadataFields` owns the render.
- [ ] Should `FieldDef` keep the name `FieldDef` or be renamed during the move? Proposed: keep `FieldDef` to minimize diff noise; renaming is a separate concern.
- [ ] Should the zod-alignment triangulation live in `item-form-fields.test.ts` or extend `structured-items.test.ts`? Proposed: keep it in the new test file so the pin lives in one place, and only import the public `validateItemMetadata`.
