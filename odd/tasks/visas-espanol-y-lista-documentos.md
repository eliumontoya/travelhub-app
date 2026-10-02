# Visas: español y lista de documentos en vivo

## Objective
Fix two reported bugs on the visas surfaces: (1) all visa UI copy is in English while the
rest of the site is Spanish; (2) after saving/requesting a document, the "documents on
file" list only updates after a full page refresh.

## Problem
- The visa detail page (`/dashboard/visas/[id]`), its components, its server actions'
  error messages, its `loading`/`not-found` files, and the client portal documents page
  (`/client/visas/[id]/documents`) were built with hardcoded English strings. The rest of
  the app (e.g. `VisasExplorer`, `NewVisaForm`) hardcodes Spanish and formats dates with
  `es-MX`.
- `VisaDocumentsPanel` copies `initialDocuments` into `useState`, so when server actions
  succeed and `router.refresh()` re-renders the server component, the stale list keeps
  rendering until a full reload.

## Scope
- `src/app/dashboard/visas/[id]/**` (page, VisaStatusControl, VisaDetailEditor,
  VisaClientManager, VisaDocumentsPanel, actions.ts, loading.tsx, not-found.tsx).
- `src/app/client/visas/[id]/documents/**` (page.tsx, actions.ts).
- Focused test for `VisaDocumentsPanel` Spanish labels and document list rendering.
- No data model, routing, auth, or business-logic changes; `data-testid` values are
  preserved so existing behavioral contracts keep working.

## Non-goals
- No i18n framework introduction; the site convention is hardcoded Spanish.
- No changes to other modules.

## Tasks
- [x] RED — focused `VisaDocumentsPanel` test asserting Spanish labels (fails in English).
- [x] GREEN — translate `VisaDocumentsPanel`; derive documents from props (fixes stale
      list after "solicitar documento", upload, reviewed/processed, re-upload).
- [x] Translate remaining dashboard visa detail surfaces + `actions.ts` errors +
      `loading.tsx` + `not-found.tsx`; align date/price formatting to `es-MX`.
- [x] Translate client portal visa documents page + its action errors.
- [x] Verify: visa unit tests + `npx tsc --noEmit`.
- [x] Work-unit commit.

## Verification
- `npx vitest run src/app/dashboard/visas src/app/client/visas`
- `npx tsc --noEmit`
- Structural readback of `VisaDocumentsPanel` prop-derivation fix (static-render harness
  cannot mount client components for a rerender test).

## Progress
- 2026-10-09: Explored visas surfaces; confirmed both bug root causes; created tracker.
- 2026-10-09: RED added (`VisaDocumentsPanel` Spanish expectations), then GREEN with the
  prop-derived documents fix. Commit `a09ceec`.
- 2026-10-09: Translated remaining dashboard detail surfaces, actions errors,
  loading/not-found, and the client portal documents page (`es-MX` formatters). Commit `34cd3b5`.
- 2026-10-09: Verified: 61 visa tests pass, `tsc --noEmit` clean. Closing.
- 2026-10-09: Pushed branch and opened PR #370 (`type:bug`) targeting `main`.
  https://github.com/eliumontoya/travelhub-app/pull/370
