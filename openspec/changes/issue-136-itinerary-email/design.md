# Design: Enviar itinerario por correo (issue #136)

## Approach

Reuse the existing email plumbing in `src/lib/email.ts` (plain `fetch` to Resend, no SDK),
mirroring `sendTripReminder`. Add a new export `sendItineraryEmail(trip, recipients, message?)`
that builds a full HTML itinerary and sends it.

### Data flow

```
Trip editor page (server component)
  └── SendItineraryEmailDialog (client component)
        └── onSubmit → sendItineraryEmailAction(tripId, formData)  [Server Action]
              └── getTripById(tripId)  → TripWithDetails
              └── sendItineraryEmail(trip, recipients, message)  [src/lib/email.ts]
                    └── Resend HTTP API
```

### Components / files

- `src/lib/email.ts`
  - Add `escapeHtml()` helper to prevent HTML injection from item titles/notes.
  - Add `sendItineraryEmail(trip: TripWithDetails, recipients: string[], message?: string)`
    returning `{ ok: boolean; reason?: string }`. Builds HTML using the same formatting
    helpers already used by the public view (`formatDateLong`, `itemTypeMeta`,
    `formatItemMetadataSummary`, `formatCost`). Costs included only if `showCostsToClient`.
    No-op/`{ ok: false, reason }` when `RESEND_API_KEY` is missing (graceful degradation).
- `src/app/dashboard/trips/[id]/actions.ts`
  - Add `sendItineraryEmailAction(tripId, formData)`:
    - `getTripById`, validate trip exists.
    - Parse comma-separated recipients; reject if empty.
    - Optional `message` field.
    - Call `sendItineraryEmail`; on success `revalidateTrip(tripId)`; return
      `{ ok, message }`.
- `src/components/SendItineraryEmailDialog.tsx` (new, `"use client"`)
  - Mirrors `TripInstructionsDialog` (`<dialog>`, `useTransition`). Recipients input
    pre-filled from `trip.clients[*].email`. Optional message textarea. Calls the server
    action directly and surfaces the returned result (success/error) in the dialog.
- `src/app/dashboard/trips/[id]/page.tsx`
  - Render the new dialog button in the action row (Spanish UI copy: "Enviar por correo").

### Email HTML
A self-contained, inline-styled HTML document: header with title + date range, optional
agent message, per-day sections listing items (icon, title, time, location, confirmation
code, metadata summary, cost if allowed), and a footer with the public URL link.

### Why these choices
- Server Action co-located with the trip (matches repo convention for mutations).
- No new DB column: keeps the first slice minimal and avoids migration churn; can be
  added later if we want to track "last sent" timestamps.
- Pure HTML string built server-side: no client-side email rendering, no new dependency.
