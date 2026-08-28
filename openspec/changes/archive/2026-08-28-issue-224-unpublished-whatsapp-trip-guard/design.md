# Design: Unpublished WhatsApp Trip Guard

## Technical Approach
Implement a shared publication guard in `src/lib/ai/tools/travelhub-client-tools.ts`. Ownership remains first so non-owned trip ids still return the existing blocked result. After ownership passes, the guard reads `trips.id,status`; non-`published` trips return an audited success result with only a planning-safe message.

## Data Flow
1. WhatsApp inbound service resolves client/trip as today.
2. A trip-scoped tool calls `guardTripTool`.
3. `guardTripTool` validates input, verifies ownership, reads status, and blocks detail exposure for non-published trips.
4. Published trips continue into existing detail queries.
5. `getClientActiveTrips` strips title, slug, and dates for non-published choices.

## Safe Planning Payload
```ts
{
  publicItineraryAvailable: false,
  safeMessage: "Tu viaje todavía está siendo planeado por un agente. En cuanto esté publicado, podrás tener más información."
}
```
No title, dates, item data, confirmations, document counts, URLs, or storage paths are included.

## Files
| File | Change |
|------|--------|
| `src/lib/ai/tools/travelhub-client-tools.ts` | Status guard + minimized choices |
| `src/lib/ai/__tests__/travelhub-client-tools.test.ts` | Unit coverage |

## Edge Cases
- Missing trip after ownership check: `not_found`.
- Audit insert failure: non-fatal.
- Payment tool: non-published guard wins before payment policy text.
