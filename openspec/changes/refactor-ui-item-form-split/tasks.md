# Tasks: Split `ItemFormDialog` into modular item-form pieces

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~330 (range 290–380) |
| 400-line budget risk | Low |
| 800-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | 1 PR with work-unit commits (schema pin → lib move → metadata extraction → documents extraction → doc freshness) |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Objective | Likely PR | Estimated lines | Effort | Focused test command | Rollback boundary |
|------|-----------|-----------|-----------------|--------|----------------------|-------------------|
| 1 | Pin the schema (RED) | PR 1 | ~120 | ~2 h | `npm run test -- item-form-fields` | `src/lib/__tests__/item-form-fields.test.ts` only |
| 2 | Move schema + helpers to lib, re-export (GREEN) | PR 1 | ~150 | ~3 h | `npm run test -- item-form-fields structured-items` | `src/lib/item-form-fields.ts`, `src/components/ItemFormDialog.tsx` import/export |
| 3 | Extract `MetadataFields` and preserve the remount key | PR 1 | ~60 | ~1.5 h | `npm run test` | `src/components/item-form/MetadataFields.tsx`, dialog call site |
| 4 | Extract `ItemDocumentsSection` (+ `DocumentPreview`) | PR 1 | ~70 | ~1.5 h | `npm run test` | `src/components/item-form/ItemDocumentsSection.tsx`, dialog call site |
| 5 | Doc freshness: `architecture.md` + `README.md` check | PR 1 | ~10 | ~0.5 h | diff review | `architecture.md` item-form/lib listing |
| 6 | Verification: tsc, build, unit, e2e local + size budget | — | ~10 | ~2 h | see Phase 6 | — |

**Total estimated effort**: ~11 h of agent work.

## Phases

### Phase 1 — Test-first schema pin (WU1, TDD RED)

- [x] 1.1 Read `src/components/ItemFormDialog.tsx:20-141` and transcribe the current schema into `src/lib/__tests__/item-form-fields.test.ts` importing `FieldDef`, `metadataFieldsByType`, `metadataDefaultValue`, `appendSerializedMetadata` from `@/lib/item-form-fields` (the module does not exist yet).
- [x] 1.2 Pin per type, in order, the field `name` list and the `required` flags for `metadataFieldsByType` (`flight`, `hotel`, `activity`, `restaurant`, `transport`, `note`).
- [x] 1.3 Pin `hotel.boardBasis` options exactly (`Solo alojamiento`, `Desayuno incluido`, `Media pensión`, `Pensión completa`, `Todo incluido`) and the declared `type` of every field (text|time|date|select|textarea).
- [x] 1.4 Pin `metadataFieldsByType.note` to be empty (`[]`).
- [x] 1.5 Pin the serialization contract of `appendSerializedMetadata`: trims values, drops blank/empty fields, sets `metadata` to `JSON.stringify(values)` or `null` when empty, and deletes every `metadata_<name>` key from `FormData`; preserves a shared `bookingReference` when switching type (mirrors `structured-items.test.ts`).
- [x] 1.6 Pin `metadataDefaultValue`: returns the string metadata value, `undefined` for missing item/metadata, and `undefined` for a non-string metadata value.
- [x] 1.7 Run `npm run test -- item-form-fields` and record the observed RED (module/exports not found). Do not implement the module yet.

### Phase 2 — Move schema and helpers to `src/lib/item-form-fields.ts` (WU2, TDD GREEN)

- [x] 2.1 Create `src/lib/item-form-fields.ts` with the `FieldDef` type and move `metadataFieldsByType` from `ItemFormDialog.tsx:27-117` verbatim (same names, labels, types, options, `required` flags; `note: []`). No content change.
- [x] 2.2 Move `metadataDefaultValue` (`:134-141`) verbatim into the new module.
- [x] 2.3 Move `appendSerializedMetadata` (`:119-131`) verbatim into the new module.
- [x] 2.4 In `ItemFormDialog.tsx`, import `metadataFieldsByType`, `metadataDefaultValue`, and `appendSerializedMetadata` from `@/lib/item-form-fields`; delete the inlined definitions.
- [x] 2.5 Add `export { appendSerializedMetadata } from "@/lib/item-form-fields";` to `ItemFormDialog.tsx` so `src/lib/__tests__/structured-items.test.ts:81` keeps importing from `@/components/ItemFormDialog`.
- [x] 2.6 Run `npm run test -- item-form-fields structured-items` — GREEN for both files.
- [x] 2.7 TRIANGULATE (cheap, if it stays cheap): add a case asserting every UI field `name` for a type is accepted by `validateItemMetadata(type, allFieldsAsStrings)`; if the zod schemas expose no shape to compare against without new exports, keep only this acceptance assertion and document the limitation in the PR.

### Phase 3 — Extract `MetadataFields` (WU3)

- [x] 3.1 Create `src/components/item-form/MetadataFields.tsx` (`"use client"`) with props `type`, `item`, `metadataAutofill`, `autofillVersion` and move the metadata block from `ItemFormDialog.tsx:461-519` into it.
- [x] 3.2 Preserve the remount key expression exactly: the root wrapper is keyed `${type}-${autofillVersion}` (same behavior as `${selectedType}-${metadataAutofillVersion}`).
- [x] 3.3 Preserve the header (`ItemTypeIcon` + `Detalles de {label.toLowerCase()}`), the field labels, the `metadata_<name>` input names, the `textarea`/`select`/`input` branches, the "Seleccionar..." placeholder, and `defaultValue={metadataAutofill[field.name] ?? metadataDefaultValue(item, field.name)}`.
- [x] 3.4 Keep the guard `type !== "note" && metadataFieldsByType[type].length > 0` — move it inside `MetadataFields` or keep it at the dialog call site, but the rendered result must be identical (no empty metadata block for `note`).
- [x] 3.5 Render `<MetadataFields type={selectedType} item={item} metadataAutofill={metadataAutofill} autofillVersion={metadataAutofillVersion} />` from the dialog and remove the inlined block. Do not change `handleSupplierSelected` or the version increments.
- [x] 3.6 Run `npm run test` — suite green; no assertion changed.

### Phase 4 — Extract `ItemDocumentsSection` (WU4)

- [x] 4.1 Create `src/components/item-form/ItemDocumentsSection.tsx` (`"use client"`) and move `DocumentPreview` (`:145-180`) plus the documents block (`:521-570`) into it.
- [x] 4.2 Define props `docs`, `docsLoading`, `uploadError`, `documentsEnabled`, `isPending`, `fileInputRef`, `onUpload`, `onDeleteDocument`; keep `DocumentPreview` private to the file.
- [x] 4.3 Preserve all branches: `url` null → filename span; `image/*` → thumbnail link; `application/pdf` → PDF link; other → link; "Cargando…"; list with per-doc "Eliminar"; uploader when `documentsEnabled`; "Configura Supabase para subir documentos." otherwise.
- [x] 4.4 Render `<ItemDocumentsSection ... />` from the dialog inside the existing `{item && ...}` guard; keep `handleUpload` / `handleDeleteDocument` and the `fileInputRef` in the dialog.
- [x] 4.5 Run `npm run test` — suite green; no assertion changed.

### Phase 5 — Dialog trim, size budget, and doc freshness (WU5)

- [x] 5.1 Confirm `ItemFormDialog.tsx` keeps only the orchestrator concerns (dialog shell, state, handlers, type/supplier/title/time/location/confirmation/cost/notes fields, actions) and re-exports `appendSerializedMetadata`.
- [x] 5.1b (addendum, orchestrator decision after Phase 4 measured 377 lines) If the dialog still exceeds ~300 lines, extract the common form fields block (title, startTime/endTime, LocationInput, confirmationCode, cost, notes RichTextEditor) as a presentational `src/components/item-form/ItemCommonFields.tsx` ("use client"); uncontrolled inputs keep their `name` attributes, callbacks/defaultValues passed verbatim; run before the 5.2 measurement.
- [x] 5.2 Measure `wc -l src/components/ItemFormDialog.tsx src/lib/item-form-fields.ts src/components/item-form/MetadataFields.tsx src/components/item-form/ItemDocumentsSection.tsx`; all must be under ~300 lines (target dialog ~240–290).
- [x] 5.3 Confirm the public props and behavior of `ItemFormDialog` are unchanged and the call sites `src/app/dashboard/trips/[id]/page.tsx:449` and `:487` are untouched.
- [x] 5.4 Doc freshness: check the `README.md` truth-source table ("Técnica (cómo está hecho)" → `architecture.md`); confirm no README edit is required, or edit it if a row aged.
- [x] 5.5 Update `architecture.md` if its `lib/` / `components/` listing ages: add `item-form-fields.ts` beside `item-meta.ts` (`architecture.md:~275`) and `components/item-form/` if the components tree enumerates subfolders. Leave the doc untouched if no listed entry aged, and record the decision in the PR.

### Phase 6 — Verification (WU6)

- [ ] 6.1 `npx tsc --noEmit` — no type errors.
- [ ] 6.2 `npm run lint` — no new lint errors in changed files.
- [ ] 6.3 `npm run test` — unit suite green (new `item-form-fields.test.ts` included, `structured-items.test.ts` unmodified).
- [ ] 6.4 `npm run build` — production build clean.
- [ ] 6.5 Start the local Supabase stack and run `npm run test:e2e -- --project=local` — green; this is the behavioral net for supplier autofill, type switch, and the documents section.
- [ ] 6.6 Confirm the size budget from 5.2 in the final diff and that no file outside the planned change set was modified.
- [ ] 6.7 Report evidence per command (exact command + observed result) and any pre-existing failure not attributable to this change.
