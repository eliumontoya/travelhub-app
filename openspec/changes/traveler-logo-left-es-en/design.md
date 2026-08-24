# Design: traveler-logo-left-es-en

Pure layout change on the public traveler page `/t/[slug]`. No data-layer, migration, Server
Action, or schema work is in scope. The logo fields (`SiteSettings.logoUrl?`, `agencyName?`)
already exist and render today, so this design only restructures markup and adds a styling
`variant` prop. Follows existing App Router / Server Component conventions (the changed files
stay Server Components; `LanguageToggle` remains a `"use client"` component — only its props and
classes change, never its switching logic).

## 1. Hero inner block restructure (`src/app/t/[slug]/page.tsx`)

### Current markup (lines 92–112)

```
<div className="mx-auto w-full max-w-2xl px-4 pb-6 text-white">
  <div className="mb-2 flex items-start justify-between gap-4">   // top row: logo LEFT + toggle RIGHT
    {(contact.logoUrl || contact.agencyName) && (<div className="flex items-center gap-3">…logo + name…</div>)}
    <LanguageToggle lang={lang} />
  </div>
  <h1>…title…</h1>
  <p>…dates…</p>
  <p>…contact…</p>
</div>
```

### Target markup

Remove the top `flex items-start justify-between` row and the inline `<LanguageToggle>`. Replace
it with a single horizontal arrangement: **logo block on the LEFT**, **title/dates/contact stack
on the RIGHT**, both inside the existing `text-white` hero surface (text-over-image look kept).

```tsx
<div className="mx-auto w-full max-w-2xl px-4 pb-6 text-white">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
    {(contact.logoUrl || contact.agencyName) && (
      <div className="flex shrink-0 items-center gap-3">
        {contact.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={contact.logoUrl}
            alt={contact.agencyName ?? "Logo"}
            className="h-12 w-auto rounded-lg bg-white/90 p-1 object-contain shadow-sm"
          />
        )}
        {contact.agencyName && (
          <span className="text-base font-semibold drop-shadow break-words">
            {contact.agencyName}
          </span>
        )}
      </div>
    )}
    <div className="min-w-0 flex-1">
      <h1 className="text-3xl font-bold">{trip.title}</h1>
      <p className="mt-1 text-sm text-white/80">
        {formatDateLong(trip.startDate, lang)} – {formatDateLong(trip.endDate, lang)}
        {" · "}
        {trip.travelerCount} {trip.travelerCount === 1 ? t.traveler : t.travelers}
      </p>
      <p className="mt-1 text-sm text-white/80">
        <a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a>
        {" · "}
        <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`} className="hover:underline">
          {contact.phone}
        </a>
      </p>
    </div>
  </div>
</div>
```

**Class rationale**
- `flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4`: stacks vertically on narrow screens
  (`< sm`), sits side-by-side from `sm:` up. `sm:items-center` vertically centers the logo next to
  the (taller) text block. `gap-3`/`sm:gap-4` gives breathing room.
- `shrink-0` on the logo container: prevents the logo/name from being squeezed when the right
  content grows (long titles, narrow `max-w-2xl` container).
- `min-w-0 flex-1` on the content stack: lets the title/email/phone wrap instead of overflowing the
  flex row, and claims all remaining width.
- `break-words` on the agency name span: long agency names wrap rather than blow out the column.

## 2. `LanguageToggle` API change (`src/components/LanguageToggle.tsx`)

Add an optional `variant` prop, defaulting to `"dark"` to preserve every existing/other usage
verbatim.

```ts
type LanguageToggleVariant = "dark" | "light";

export function LanguageToggle({
  lang,
  variant = "dark",
}: {
  lang: Lang;
  variant?: LanguageToggleVariant;
}) {
```

**Variant class maps** (container + per-button). The switching logic (`setLang`, the
`useEffect`, `localStorage`, `?lang=` sync) is unchanged.

| Layer            | `dark` (default, today's look)                     | `light` (new, below hero)                              |
|------------------|----------------------------------------------------|--------------------------------------------------------|
| Container        | `inline-flex overflow-hidden rounded-md border border-white/40 text-xs` | `inline-flex overflow-hidden rounded-md border border-gray-300 text-xs dark:border-gray-600` |
| Inactive button  | `text-white/80 hover:bg-white/10`                  | `text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800` |
| Active button    | `bg-white text-gray-900`                           | `bg-gray-900 text-white`                              |

Suggested implementation — derive class fragments once:

```tsx
const containerCls =
  variant === "light"
    ? "inline-flex overflow-hidden rounded-md border border-gray-300 text-xs dark:border-gray-600"
    : "inline-flex overflow-hidden rounded-md border border-white/40 text-xs";

const btn = (active: boolean) =>
  variant === "light"
    ? `px-2 py-1 ${active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"}`
    : `px-2 py-1 ${active ? "bg-white text-gray-900" : "text-white/80 hover:bg-white/10"}`;
```

Then `className={containerCls}` on the wrapper and `className={btn(lang === "es")}` /
`className={btn(lang === "en")}` on the buttons. The `dark` variant is byte-for-byte identical to
today, so default preserves behavior with zero regression risk for any current caller.

## 3. Placement of the moved toggle below the hero (`src/app/t/[slug]/page.tsx`)

Render `<LanguageToggle lang={lang} variant="light" />` **outside** the `print:hidden` hero `div`,
in a wrapper that aligns with the page container and never prints:

```tsx
{/* …hero div closes… */}

<div className="mx-auto mt-4 max-w-2xl px-4 print:hidden">
  <LanguageToggle lang={lang} variant="light" />
</div>

{/* existing hidden print:block header stays as-is */}
<div className="hidden print:block px-4 pt-4">…</div>
```

**Class rationale**
- `mx-auto max-w-2xl px-4`: same horizontal alignment and left padding as the hero inner block, so
  the toggle sits directly under the hero content rather than flush-left of the wider `lg:max-w-5xl`
  itinerary grid.
- `mt-4`: small gap from the hero box; not a separate card.
- `print:hidden`: guarantees the toggle is excluded from print output (today it lived inside the
  `print:hidden` hero, so this preserves current print behavior — see R2).

## 4. Decisions with rationale

- **(a) No visible card (A1).** The brief's "cuadro" refers to the existing hero content block, not
  a bordered card. Adding a card would change the visual language of the page and grow scope. We
  keep the text-over-cover-image look; the toggle sits on the bare `bg-gray-50` surface with no
  border/background of its own. If a visible card is later requested, that is Approach 2 (out of
  scope, flag at approval).
- **(b) `variant` prop vs. a separate component.** A single `variant` prop keeps one component, one
  file, one set of tests, and one import site. The two variants share 100% of behavior and only
  differ in color tokens. A separate component would duplicate switching logic and drift on future
  i18n changes. Default `"dark"` makes the change strictly additive for all existing/other callers.
- **(c) Print & responsive handling.** Print: the hero is `print:hidden` already; the moved toggle
  gets its own `print:hidden` so language selection (a UI control) is never printed. The printed
  language is driven by `?lang=`, not the toggle. Responsive: `flex-col → sm:flex-row` prevents the
  side-by-side logo/content from crowding phones; below `sm` the logo stacks above the content,
  which is acceptable and readable.

## 5. Edge cases

- **Logo absent** (`logoUrl` and `agencyName` both falsy): the `(contact.logoUrl ||
  contact.agencyName)` guard skips the left block entirely; the right `min-w-0 flex-1` stack takes
  the full `max-w-2xl` width. No empty flex gap, no broken layout.
- **Long agency names**: `break-words` on the name span + `shrink-0` on the logo container let the
  name wrap within its column on `sm:flex-row`; on `flex-col` it naturally occupies full width and
  wraps. No horizontal overflow.
- **Narrow screens (`< sm`)**: arrangement collapses to `flex-col` — logo block on top, content
  below. `text-white` logo stays legible over the cover image; the `bg-white/90` logo chip keeps
  transparent PNGs readable.
- **Print**: hero + moved toggle are both `print:hidden`; the dedicated `hidden print:block` header
  (lines ~134–139) carries the title/dates. No language control prints.

## 6. Out of scope (confirmed unchanged)

Cover-image hero dimensions (`h-56 sm:h-72`), gradient overlay, `print:hidden` hero, data layer
(`src/lib/data.ts`), `SiteSettings` schema / migration `0033_site_settings_branding.sql`, settings
form, `ThemeToggle`, `AddTripToCalendarButton`, `PrintButton`, sidebar, and all itinerary content
below. `LanguageToggle` behavior (persistence, `?lang=` sync, `router.replace`) is untouched.
