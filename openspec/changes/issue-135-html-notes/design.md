# Design: Rich HTML notes

## Sanitization strategy (defense in depth)

- `src/lib/sanitize.ts` exports `sanitizeNote(html)` using `sanitize-html`
  with an allowlist: `p, br, div, span, strong, b, em, i, u, ul, ol, li, a,
  h1-h3, blockquote, code, pre, hr`. Only `a[href,target,rel]` attributes are
  allowed; schemes restricted to `http/https/mailto`; `a` tags forced to
  `target="_blank" rel="noopener noreferrer"`. `noteToPlainText` strips to
  text for CSV.
- Single write choke point: every note-writing path in `src/lib/data.ts`
  (`updateClient`, `updateSupplier`, `createTripDay`/`updateTripDay`,
  `createItem`/`updateItem`, `updateTripInternalNotes`) calls `sanitizeNote`.
- Single render choke point: `NoteHtml` (server component, no `"use client"`)
  re-sanitizes before `dangerouslySetInnerHTML` so legacy/by-passed data is
  still safe, especially for the public `/t/[slug]` view.

## Editor

- `src/components/RichTextEditor.tsx` (`"use client"`): a `contentEditable`
  div + toolbar (bold/italic/underline/lists/link via `document.execCommand`)
  synced to a hidden `<textarea name={name}>` on every input. Uncontrolled
  (innerHTML set via ref) to avoid React/contentEditable conflicts; resets when
  `defaultValue` changes so reusing a dialog for another record is correct.
- Drop-in replacement for the existing note `<textarea name="notes">` /
  `name="internalNotes"` in `ItemFormDialog`, `DayFormDialog`,
  `TripInternalNotesDialog`, `clients/[id]/page.tsx`, `CreateSupplierDialog`.

## Why not a heavier WYSIWYG

A full editor (TipTap/ProseMirror) adds bundle weight and complexity for a
marginal gain. `document.execCommand` is deprecated but universally supported
and sufficient for basic inline/block formatting; revisit only if richer needs
arise (tables, images).

## CSV export

`export-clients-csv-button.tsx` is a client component and cannot import the
Node-only server sanitizer, so it strips tags locally with `DOMParser` +
`textContent`.
