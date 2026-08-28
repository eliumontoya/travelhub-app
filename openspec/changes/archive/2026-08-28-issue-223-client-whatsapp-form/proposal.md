# Proposal: Client WhatsApp Form Field

## Intent

Expose the existing client WhatsApp field in the CRM form so the agent can maintain the number used by WhatsApp automation. When WhatsApp is left blank but phone is present, saving MUST store phone as WhatsApp, matching issue #223 and the database fallback from issue #221.

## Proposal Question Round

Assumptions from issue #223: first slice is the authenticated client form; blank WhatsApp intentionally copies from phone; explicit WhatsApp stays separate. Creation from the new-trip inline form should also support the same rule where practical.

## Scope

### In Scope
- Add WhatsApp input to client detail edit form.
- Submit WhatsApp in client create/update Server Actions with blank-to-phone fallback.
- Keep explicit WhatsApp values when present.
- Add focused tests/spec updates for mock/action behavior.

### Out of Scope
- New database migration; issue #221 already added columns/trigger/index.
- Changing inbound WhatsApp lookup priority.
- Public exposure of WhatsApp numbers.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `client-crm`: client records include optional WhatsApp and copy phone into WhatsApp when blank on save.

## Approach

Use existing App Router Server Actions and `src/lib/data.ts`. Forms post `whatsapp`; actions compute `whatsapp || phone || undefined` before calling `createClient`/`updateClient` so Supabase and mock mode behave consistently.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/dashboard/clients/[id]/page.tsx` | Modified | Render WhatsApp input/helper text. |
| `src/app/dashboard/clients/[id]/actions.ts` | Modified | Persist WhatsApp fallback on update. |
| `src/app/dashboard/clients/actions.ts` | Modified | Persist WhatsApp fallback on create. |
| `src/app/dashboard/trips/new/*` | Modified | Optional inline new-client WhatsApp support. |
| `src/lib/__tests__/data.test.ts` | Modified | Cover fallback/preservation in mock mode. |
| `openspec/specs/client-crm/spec.md` | Modified | Archive updated client record behavior. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Clearing WhatsApp copies phone again | Medium | Add helper text and tests. |
| Inline create flows diverge | Low | Add field/fallback where new clients are created. |

## Rollback Plan

Revert UI/action/test/spec changes. Existing DB WhatsApp columns from issue #221 remain harmless.

## Dependencies

- Issue #221 migration deployed/applied for Supabase environments.

## Success Criteria

- [ ] Client detail form shows and saves WhatsApp.
- [ ] Blank WhatsApp saves as phone when phone is present.
- [ ] Explicit WhatsApp is preserved when different from phone.
- [ ] Tests, typecheck, lint, and build pass.
