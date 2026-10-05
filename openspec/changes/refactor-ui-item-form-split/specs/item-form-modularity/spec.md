# Item Form Modularity Specification

## Purpose

Keep the item form's per-type metadata behavior identical while reducing `src/components/ItemFormDialog.tsx` (592 lines) to an orchestrator under ~300 lines. The editable-field schema becomes a single, tested library source of truth; metadata serialization stays importable from its current path; the data-driven metadata renderer and the documents section become bounded subcomponents. This is a pure refactor: no behavior, design, markup, or validation change.

Baseline: `baseline-from-current-implementation` — every requirement below describes behavior that already exists today and MUST remain observable-equivalent after the split (issue #373, PR 1 of 4).

Scope: `src/lib/item-form-fields.ts`, `src/components/item-form/MetadataFields.tsx`, `src/components/item-form/ItemDocumentsSection.tsx`, `src/components/ItemFormDialog.tsx`, and the technical documentation in `architecture.md`.

## Requirements

### Requirement: Single tested source of truth for the item-form field schema

The editable-field schema MUST live in a library module (`src/lib/item-form-fields.ts`) rather than inside a client component, consistent with the existing `src/lib/item-meta.ts` and `src/lib/item-metadata-schemas.ts` precedent. The module MUST expose one `Record<ItemType, FieldDef[]>` keyed by the six item types, where each field definition carries `name`, `label`, `type` (`text | time | date | select | textarea`), optional `options`, and optional `required`. The module MUST be covered by a deterministic unit test that pins the exact per-type field sets.

#### Scenario: Per-type field sets pinned

- GIVEN the schema currently inlined in `src/components/ItemFormDialog.tsx`
- WHEN the unit test `src/lib/__tests__/item-form-fields.test.ts` runs against `@/lib/item-form-fields`
- THEN it MUST assert, per item type, the ordered field `name` list and each field's `required` flag
- AND the assertion MUST fail before the module exists (RED) and pass after the exact schema is moved (GREEN).

#### Scenario: Select options and field types pinned

- GIVEN the `hotel` type's `boardBasis` field and the declared `type` of every field
- WHEN the pin test runs
- THEN `boardBasis` MUST expose exactly the five options `Solo alojamiento`, `Desayuno incluido`, `Media pensión`, `Pensión completa`, `Todo incluido`
- AND every field's declared `type` MUST match the current inline schema.

#### Scenario: Note type has no metadata fields

- GIVEN the `note` item type
- WHEN the schema is read
- THEN `metadataFieldsByType.note` MUST be an empty field list
- AND the metadata block MUST NOT render for `note`.

### Requirement: Stable metadata serialization contract

`appendSerializedMetadata` MUST remain importable from `@/components/ItemFormDialog` (re-exported from the library module) so existing consumers keep working without edits. Its observable behavior MUST be unchanged: trim each `metadata_<name>` value, keep only non-empty values, delete the `metadata_<name>` keys from the `FormData`, and set `metadata` to the JSON of the collected values or `null` when none remain.

#### Scenario: Existing import path keeps working

- GIVEN `src/lib/__tests__/structured-items.test.ts` importing `appendSerializedMetadata` from `@/components/ItemFormDialog`
- WHEN the unit suite runs after the move
- THEN the file MUST pass without being modified
- AND `appendSerializedMetadata` MUST be re-exported from `src/components/ItemFormDialog.tsx`.

#### Scenario: Empty metadata serializes to null

- GIVEN a `FormData` with blank or missing `metadata_*` fields
- WHEN `appendSerializedMetadata(formData, type)` runs
- THEN the `metadata` entry MUST be `"null"`
- AND the `metadata_*` keys MUST have been removed from the `FormData`.

#### Scenario: Shared bookingReference preserved across type switch

- GIVEN a `FormData` carrying `metadata_bookingReference` and the fields of another type
- WHEN `appendSerializedMetadata(formData, type)` runs
- THEN the serialized `metadata` MUST retain `bookingReference`
- AND this behavior MUST remain covered by a test.

### Requirement: Per-type metadata rendering behavior unchanged

The data-driven metadata block MUST render from the library schema with the same inputs, labels, required flags, and autofill values as before. The remount expression `${type}-${autofillVersion}` MUST be preserved exactly, so uncontrolled inputs re-apply `defaultValue` when the selected type changes or supplier autofill increments the version.

#### Scenario: Metadata fields render from the schema

- GIVEN a selected item type other than `note`
- WHEN the form metadata block renders
- THEN it MUST render one field per `metadataFieldsByType[type]` entry
- AND each input MUST use the name `metadata_<field.name>` with its declared label, type, and required flag.

#### Scenario: Remount key preserved on autofill

- GIVEN a supplier is selected and `metadataAutofillVersion` increments
- WHEN the metadata block re-renders
- THEN its root wrapper MUST be keyed `${type}-${autofillVersion}`
- AND the uncontrolled inputs MUST be recreated so `defaultValue` re-applies the autofilled values.

#### Scenario: Selection options rendered for select fields

- GIVEN a field declared as `select` with `options`
- WHEN it renders
- THEN it MUST include the `Seleccionar...` placeholder option followed by the declared options
- AND it MUST default to the autofill value, the item metadata value, or the empty string.

### Requirement: Item documents section behavior unchanged

The documents section MUST be extracted as `src/components/item-form/ItemDocumentsSection.tsx`, including `DocumentPreview`, and MUST preserve identical rendering for every document kind and for the loading, upload-enabled, and upload-disabled states.

#### Scenario: Document kinds previewed identically

- GIVEN a document with a null `url`, an image MIME type, a `application/pdf` MIME type, or another MIME type
- WHEN `DocumentPreview` renders it
- THEN it MUST produce the same markup as today (filename span; thumbnail link; PDF link; generic link respectively).

#### Scenario: Documents list and uploader states

- GIVEN the section receives `docsLoading`, `docs`, `uploadError`, and `documentsEnabled`
- WHEN it renders
- THEN it MUST show "Cargando…" while loading, the list with a per-document "Eliminar" action, the upload error when present, the uploader when documents are enabled, and the "Configura Supabase para subir documentos." fallback otherwise
- AND the section MUST only be rendered when the dialog is editing or creating an existing item, as today.

### Requirement: Modular boundaries with a file-size budget

`ItemFormDialog.tsx` MUST become an orchestrator that owns state and side effects and delegates presentation to the extracted subcomponents. No file in the item-form surface MUST exceed ~300 lines. The refactor MUST NOT introduce per-type field components.

#### Scenario: File-size budget met

- GIVEN the final diff
- WHEN line counts are measured for `src/components/ItemFormDialog.tsx`, `src/lib/item-form-fields.ts`, `src/components/item-form/MetadataFields.tsx`, and `src/components/item-form/ItemDocumentsSection.tsx`
- THEN every file MUST be under ~300 lines
- AND `ItemFormDialog.tsx` MUST be under ~300 lines.

#### Scenario: One generic renderer, not six

- GIVEN the metadata rendering
- WHEN the implementation is reviewed
- THEN there MUST be a single data-driven `MetadataFields` component
- AND there MUST NOT be one component per item type duplicating the same loop.

### Requirement: Pure refactor with no observable change

The change MUST be limited to module boundaries. Public props, form behavior, validation, copy, markup order, and product assertions MUST remain unchanged. Only `src/components/ItemFormDialog.tsx` and the new item-form files (plus the `architecture.md` text if it aged) MAY change.

#### Scenario: Call sites unchanged

- GIVEN `src/app/dashboard/trips/[id]/page.tsx` call sites for edit (`:449`) and create (`:487`)
- WHEN the refactor lands
- THEN both call sites MUST remain unmodified
- AND the `ItemFormDialog` public props MUST be unchanged.

#### Scenario: Product behavior intact

- GIVEN the refactor diff
- WHEN the unit and local e2e suites run
- THEN no existing assertion about behavior, texts, states, or document handling MUST have been removed or weakened
- AND `structured-items.test.ts` MUST pass without modification.

#### Scenario: Documentation source of truth checked

- GIVEN the README truth-source table (technical topics → `architecture.md`)
- WHEN the change is reviewed
- THEN `architecture.md` MUST list the new `item-form-fields.ts` module and the `components/item-form/` subcomponents if its existing listings enumerate them
- AND the README table MUST be verified and left unchanged unless a row aged.
