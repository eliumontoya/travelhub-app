# Proposal: Split `ItemFormDialog` into modular item-form pieces

**Change slug:** `refactor-ui-item-form-split`
**Issue:** [#373 — Reducir los componentes sobredimensionados del editor de viaje y dashboard](https://github.com/eliumontoya/travelhub-app/issues/373) (PR 1 of 4)
**Phase:** propose
**Status:** ready for spec + design

## Intent

`src/components/ItemFormDialog.tsx` is 592 lines and is the first of four oversized files called out by issue #373. A single client component currently mixes four independent concerns:

1. **Per-type metadata field schema** — `metadataFieldsByType` (`:27-117`) and the field-definition type (`MetadataFieldDef`, `:20-26`) describe the editable metadata for the six item types (`flight`, `hotel`, `activity`, `restaurant`, `transport`, `note`).
2. **Metadata serialization** — `appendSerializedMetadata` (`:119-131`), the only module-level helper consumed by another module (`src/lib/__tests__/structured-items.test.ts:81`).
3. **Data-driven metadata renderer** — a single loop over the selected type's field list (`:461-519`), keyed by `${selectedType}-${metadataAutofillVersion}` so that supplier autofill re-applies uncontrolled `defaultValue`s.
4. **Documents section** — `DocumentPreview` (`:145-180`) plus the list/upload/delete UI (`:521-570`).

The size makes the file hard to review and to change safely: a schema edit, a serialization change, and a documents-UI change all touch the same 592-line surface. The goal is a **pure refactor** — zero behavior and zero design change — that leaves every resulting file under ~300 lines and puts the schema where the rest of the UI schema already lives (`src/lib/`). One PR.

### Evidence

- `ItemFormDialog.tsx` is `"use client"` and handles `flight | hotel | activity | restaurant | transport | note`.
- `metadataFieldsByType` is the single-source field schema; `note` maps to an empty array.
- `appendSerializedMetadata` is imported today as `@/components/ItemFormDialog` by `src/lib/__tests__/structured-items.test.ts:81`; that import path must stay stable.
- The metadata block remount key is `${selectedType}-${metadataAutofillVersion}`; suppliers autofill via `handleSupplierSelected` and increment `metadataAutofillVersion`.
- Only two call sites: `src/app/dashboard/trips/[id]/page.tsx:449` (edit) and `:487` (create).
- Behavioral nets already exist: `structured-items.test.ts`, `src/lib/item-metadata-schemas.ts` (with `item-meta` tests), and the Playwright `e2e/local/supplier-item-compatibility.spec.ts`.

## Scope

### In Scope

- Move `metadataFieldsByType`, the field-definition type (`FieldDef`), `metadataDefaultValue`, and `appendSerializedMetadata` from `ItemFormDialog.tsx` into a new `src/lib/item-form-fields.ts`, mirroring the `item-meta.ts` / `item-metadata-schemas.ts` precedent of UI schema living in `lib` with tests.
- Add `src/lib/__tests__/item-form-fields.test.ts` that pins the **current** per-type field sets (names, `required` flags, option lists per type, `note` empty) so the move is behavior-pinned, following strict TDD (RED before the move, GREEN after).
- Extract a generic, data-driven `MetadataFields` client subcomponent in `src/components/item-form/MetadataFields.tsx` receiving `type`, `item`, `metadataAutofill`, and `autofillVersion`, preserving the exact remount-key semantics.
- Extract the documents section — including `DocumentPreview` — into `src/components/item-form/ItemDocumentsSection.tsx`.
- Keep `ItemFormDialog.tsx` as the orchestrator and trim it to under ~300 lines.
- Re-export `appendSerializedMetadata` from `ItemFormDialog.tsx` so the existing unit-test import path keeps working.
- Update `architecture.md` if its `components/` / `lib/` listing ages; verify the README truth-source table.

### Out of Scope

- Any behavior, copy, validation, styling, markup, DOM-order, or `expect` change. The refactor is observably neutral.
- Per-type field components (`FlightFields`, `HotelFields`, `ActivityFields`, …). Rejected: the schema is data-driven, and splitting per type would duplicate the same loop six times.
- Changing the contents of `metadataFieldsByType`, the zod schemas in `src/lib/item-metadata-schemas.ts`, or the semantics of `appendSerializedMetadata`.
- The other three issue #373 files (`src/app/dashboard/trips/[id]/page.tsx`, `ServiceChecklistManager.tsx`, `DashboardFilters.tsx`); each gets its own change and PR.
- New dependencies, new global state, or moving logic into `src/lib/data.ts`.

## Capabilities

> This section is the CONTRACT between proposal and specs.

### New Capabilities

- `item-form-modularity`: the item form's per-type field schema is a single, tested library source of truth; its serialization and rendering contracts remain observably equivalent after the split; the dialog is composed of bounded subcomponents; and no file in the item-form surface exceeds the ~300-line budget. Covers `src/lib/item-form-fields.ts`, `src/components/item-form/MetadataFields.tsx`, `src/components/item-form/ItemDocumentsSection.tsx`, and `src/components/ItemFormDialog.tsx`.

### Modified Capabilities

- None. This change is a pure refactor and does not alter the observable contract of any domain capability (itinerary editing, documents, provider autofill). Only the internal module boundaries change.

## Approach

1. **Pin the schema before moving it (TDD).** Write `item-form-fields.test.ts` encoding the exact per-type field sets currently inlined in `ItemFormDialog.tsx`. Run `npm run test` and observe RED (the target module/exports do not exist yet). Then move the schema verbatim into `src/lib/item-form-fields.ts` for GREEN.
2. **Follow the lib precedent.** Put the field schema and serialization in `src/lib/item-form-fields.ts`, next to `item-meta.ts` and `item-metadata-schemas.ts`, so the schema is unit-testable without importing a client component.
3. **Keep the serialization contract stable.** Move `appendSerializedMetadata` into the same lib module and re-export it from `ItemFormDialog.tsx`; `@/components/ItemFormDialog` remains a valid import path.
4. **One generic renderer, not six.** Extract `MetadataFields` as a single data-driven component contributing the same loop, the same `metadata_<name>` field names, and the same required flags.
5. **Extract the documents section.** Move `DocumentPreview` and the documents list/upload/delete UI into `ItemDocumentsSection.tsx`, with callbacks and state owned by the dialog.
6. **Preserve the remount key.** The expression `${type}-${autofillVersion}` must be reproduced exactly so uncontrolled inputs re-apply `defaultValue` after type change/autofill.
7. **Enforce the budget.** Measure every resulting file; `ItemFormDialog.tsx` and each new file must be under ~300 lines.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/item-form-fields.ts` | New | `FieldDef` type, `metadataFieldsByType`, `metadataDefaultValue`, `appendSerializedMetadata`. Verbatim move of the schema; no content change. |
| `src/lib/__tests__/item-form-fields.test.ts` | New | Pins the per-type field sets (names, `required`, options, `note` empty) and the serialization contract. Written RED-first. |
| `src/components/item-form/MetadataFields.tsx` | New | Generic data-driven metadata renderer; owns the preserved remount key. |
| `src/components/item-form/ItemDocumentsSection.tsx` | New | Documents section plus `DocumentPreview`; receives docs state and callbacks. |
| `src/components/ItemFormDialog.tsx` | Modified | Becomes the orchestrator; imports the lib schema and the two subcomponents; re-exports `appendSerializedMetadata`. Under ~300 lines. |
| `src/lib/__tests__/structured-items.test.ts` | Verified | Import path `@/components/ItemFormDialog` must still resolve via the re-export. No edit expected. |
| `src/app/dashboard/trips/[id]/page.tsx` | Verified | The two call sites (`:449`, `:487`) and the public props stay unchanged. No edit expected. |
| `architecture.md` | Modified/Verified | Technical source of truth: add `item-form-fields.ts` and `components/item-form/` to the lib/components listing if that listing ages. |
| `README.md` | Verified | Truth-source table: "Técnica (cómo está hecho)" points to `architecture.md`; confirm no README edit is required. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A field is transcribed with a wrong name, `required` flag, or option list during the move | Medium | The RED-first pin test encodes the exact current schema before the move; GREEN requires a byte-accurate move. Review the moved object against the deleted block in the same diff. |
| The remount key semantics drift, so autofill/type-switch stops refreshing uncontrolled inputs | Medium | Reproduce `${type}-${autofillVersion}` exactly; the `supplier-item-compatibility` e2e spec is the behavioral net; inspect the rendered key in the diff. |
| `structured-items.test.ts` breaks because the import path changes | Low | Re-export `appendSerializedMetadata` from `ItemFormDialog.tsx`; `npm run test` covers it. |
| Hidden coupling to module-level `itemTypes` / `itemTypeMeta` leaks during extraction | Low | Keep `itemTypes` derived from `itemTypeMeta` in the dialog; subcomponents receive props, not module state. |
| The refactor silently changes behavior while "just moving code" | Medium | Requirements and tasks forbid any assertion, DOM-order, or copy change; the full unit + e2e suites run before completion. |
| `ItemFormDialog.tsx` stays above ~300 lines because the extraction is partial | Medium | Measure with `wc -l` in a verification task; finish the split rather than accept a partial result. |

## Rollback Plan

- Revert the commits of this change. `ItemFormDialog.tsx` returns to its pre-refactor version, and the three new files (`src/lib/item-form-fields.ts`, `src/components/item-form/MetadataFields.tsx`, `src/components/item-form/ItemDocumentsSection.tsx`) plus the new test are deleted. The pre-existing `structured-items.test.ts` import path never changed, so no test needs a revert.
- No migrations, no schema changes, no `src/lib/data.ts` changes, no dependency changes: the rollback is a low-risk revert.

## Dependencies

- Existing Vitest unit runner (`npm run test`) and Playwright local project (`npm run test:e2e -- --project=local`) plus the local Supabase stack, already used by the repo.
- The `README.md` truth-source table row for technical topics, which points to `architecture.md`.
- No new packages.

## Success Criteria

- [ ] `src/lib/__tests__/item-form-fields.test.ts` pins the per-type field sets and the serialization contract, and fails before the module exists (RED) and passes after the move (GREEN).
- [ ] `metadataFieldsByType`, the field-definition type, `metadataDefaultValue`, and `appendSerializedMetadata` live in `src/lib/item-form-fields.ts`.
- [ ] `appendSerializedMetadata` remains importable from `@/components/ItemFormDialog` (re-export), so `structured-items.test.ts` passes unmodified.
- [ ] `src/components/item-form/MetadataFields.tsx` renders the metadata block from the schema and preserves the `${type}-${autofillVersion}` remount key.
- [ ] `src/components/item-form/ItemDocumentsSection.tsx` owns the documents section and `DocumentPreview`.
- [ ] `ItemFormDialog.tsx` and every new file are under ~300 lines.
- [ ] No behavior, design, copy, or assertion changes; the two call sites in `src/app/dashboard/trips/[id]/page.tsx` are unchanged.
- [ ] `npx tsc --noEmit`, `npm run build`, `npm run test`, and `npm run test:e2e -- --project=local` (Supabase stack up) pass.
- [ ] `architecture.md` is updated if its lib/components listing aged, and the `README.md` truth-source table is verified.
