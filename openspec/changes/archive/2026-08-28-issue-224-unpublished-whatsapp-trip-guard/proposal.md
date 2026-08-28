# Proposal: Unpublished WhatsApp Trip Guard

## Intent
Prevent WhatsApp automation from sharing trip details before the agent publishes the trip. If a customer asks early, the bot must only say the trip is still being planned and more information will be available after publication.

## Scope
### In Scope
- Gate trip-scoped TravelHub client tools on `trips.status === "published"`.
- Return a safe planning-only payload for non-published trips.
- Minimize unpublished trip data in active-trip choices.
- Add focused tests and update SDD specs.

### Out of Scope
- Dashboard publication workflow changes.
- New statuses or migrations.
- WhatsApp credential/webhook transport changes.

## Capabilities
### New Capabilities
- None

### Modified Capabilities
- `whatsapp-inbound-automation`: dynamic TravelHub tools must not expose unpublished trip details.

## Approach
Add a shared publication guard after ownership validation in `travelhub-client-tools.ts`; sanitize non-published active-trip choices.

## Affected Areas
| Area | Impact |
|------|--------|
| `src/lib/ai/tools/travelhub-client-tools.ts` | Published guard + sanitized choices |
| `src/lib/ai/__tests__/travelhub-client-tools.test.ts` | Guard coverage |
| `openspec/specs/whatsapp-inbound-automation/spec.md` | Updated contract |

## Risks
- Bot escalates instead of sending safe planning text → return successful safe payload only.
- Draft details leak through active-trip lookup → strip non-published metadata.

## Rollback Plan
Revert this change's implementation commit and SDD archive changes.

## Dependencies
- GitHub issue #224 with `status:approved`.

## Success Criteria
- [ ] Non-published tools return only planning-safe text.
- [ ] Published trips keep existing behavior.
- [ ] Focused tests and build checks pass.
