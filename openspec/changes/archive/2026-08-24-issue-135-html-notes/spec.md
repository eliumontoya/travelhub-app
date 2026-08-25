# Spec: Rich HTML notes

**Baseline**: baseline-from-current-implementation

## Purpose

Allow agents to author enriched (HTML) notes and render them safely for both
authenticated dashboard views and the public traveler view.

## Requirements

### Requirement: Sanitized note storage

The data layer MUST store note text as HTML sanitized through a single
server-side `sanitizeNote` helper before persisting `client.notes`,
`trip_days.notes`, `items.notes`, `suppliers.notes`, and `trips.internal_notes`.

#### Scenario: Script tags are stripped on write

- GIVEN an agent submits a note containing `<script>alert(1)</script>`
- WHEN the value is persisted through `src/lib/data.ts`
- THEN the stored value MUST NOT contain a `<script>` tag

#### Scenario: Allowed formatting is preserved

- GIVEN an agent submits `<p>Texto <strong>clave</strong></p><ul><li>a</li></ul>`
- WHEN the value is persisted
- THEN the stored value MUST retain `<strong>` and the `<ul>/<li>` list

### Requirement: Safe note rendering

The system MUST render note HTML through a `NoteHtml` component that
re-sanitizes before output, so untrusted or legacy content cannot inject
scripts, event handlers, or `javascript:` URLs into the DOM.

#### Scenario: XSS payload is neutralized on render

- GIVEN a stored note `<img src=x onerror=alert(1)><a href="javascript:evil()">x</a>`
- WHEN it is rendered via `NoteHtml`
- THEN the output MUST NOT contain `onerror` and MUST NOT contain `javascript:`

#### Scenario: Links open safely

- GIVEN a rendered note contains an `<a href="https://ok.com">`
- WHEN it is displayed
- THEN the anchor MUST include `target="_blank"` and `rel="noopener noreferrer"`

### Requirement: Rich text editor

The note input controls MUST use a `RichTextEditor` supporting bold, italic,
underline, unordered/ordered lists, and links, submitting sanitized HTML via a
form field named `notes` (or `internalNotes`).

#### Scenario: Toolbar produces HTML

- GIVEN the agent selects text and clicks "Negrita"
- WHEN the form is submitted
- THEN `formData.get("notes")` MUST contain `<strong>` markup for that text

### Requirement: Public traveler view

The public trip view (`/t/[slug]`) MUST render `items.notes` as enriched HTML
through `NoteHtml`.

#### Scenario: Public item note shows formatting

- GIVEN a published trip item has notes `<em>recordatorio</em>`
- WHEN a traveler opens the public URL
- THEN the note is displayed with italic emphasis and without raw HTML tags

### Requirement: Plain-text export

The client CSV export MUST contain note text with HTML tags stripped.

#### Scenario: CSV has no markup

- GIVEN a client note `<p>Hola <strong>mundo</strong></p>`
- WHEN the agent exports clients to CSV
- THEN the Notes column for that client MUST contain `Hola mundo`
