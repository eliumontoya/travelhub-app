# Proposal: Rich HTML notes (issue #135)

## Problem

Note text fields across TravelHub render as plain text only. Agents want
enriched notes (bold, italics, lists, links) for client notes, trip/day
notes, item notes, supplier notes, and internal trip notes.

## Why now

Issue #135 ("Notas globales y de item en HTML") asks explicitly that note
texts be enriched (HTML). The public traveler view (`/t/[slug]`) renders item
notes, so any HTML support MUST be XSS-safe for unauthenticated clients.

## Approach

- Store note fields as sanitized HTML in the existing data layer.
- Sanitize on write (single choke point in `src/lib/data.ts`) AND on render
  (`NoteHtml` server component) for defense-in-depth.
- Provide a lightweight `RichTextEditor` client component (contentEditable +
  toolbar) as a drop-in replacement for the current note `<textarea>`s.

## Rollback plan

Notes remain string columns — no schema migration required. Reverting the UI
files restores plain-text textareas; stored HTML still degrades gracefully to
plain text when rendered without `NoteHtml`. No data backfill needed.

## Assumptions

- "Notas globales" interpreted as client, trip-day, supplier and internal
  trip notes; "de item" as item notes. All note fields get the same treatment.
- A minimal toolbar (bold/italic/underline/lists/link) satisfies "enriquecidos"
  without pulling in a heavy WYSIWYG dependency.
- `sanitize-html` (server-only Node lib) is acceptable; client CSV export strips
  tags locally via `DOMParser` instead of importing the server sanitizer.
