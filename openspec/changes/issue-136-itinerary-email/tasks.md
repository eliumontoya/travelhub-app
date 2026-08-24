# Tasks: Enviar itinerario por correo (issue #136)

## Phase 1 — Email delivery function
- [ ] 1.1 In `src/lib/email.ts`, add `escapeHtml()` helper.
- [ ] 1.2 Add `sendItineraryEmail(trip: TripWithDetails, recipients: string[], message?: string)`
      that builds the HTML itinerary and sends via Resend, returning `{ ok, reason? }`.
      Degrade gracefully when `RESEND_API_KEY` is absent. Include costs only when
      `showCostsToClient` is true.

## Phase 2 — Server Action
- [ ] 2.1 In `src/app/dashboard/trips/[id]/actions.ts`, add `sendItineraryEmailAction(tripId, formData)`
      that validates the trip, parses recipients (comma-separated, reject empty), reads
      optional `message`, calls `sendItineraryEmail`, revalidates, and returns `{ ok, message }`.

## Phase 3 — UI dialog
- [ ] 3.1 Create `src/components/SendItineraryEmailDialog.tsx` (client component) mirroring
      `TripInstructionsDialog`: `<dialog>`, `useTransition`, recipients pre-filled from
      `trip.clients[*].email`, optional message, surfaces action result.
- [ ] 3.2 Wire the dialog button into `src/app/dashboard/trips/[id]/page.tsx` action row
      ("Enviar por correo").

## Phase 4 — Verify
- [ ] 4.1 Run `npx tsc --noEmit` and `npm run build`; fix any errors.
