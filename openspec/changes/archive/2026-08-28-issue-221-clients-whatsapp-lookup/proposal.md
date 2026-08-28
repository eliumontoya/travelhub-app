# Proposal: CRM WhatsApp Client Lookup

## Intent
Resolve inbound WhatsApp senders from TravelHub's CRM client record (`clients.whatsapp`) so dynamic tools can find the right client and their trips without requiring a manual `whatsapp_contacts` link.

## Scope

### In Scope
- Add nullable `clients.whatsapp` with initial backfill from `phone` and a DB trigger that copies `phone` when `whatsapp` is blank.
- Add an indexed normalized lookup for WhatsApp phone matching `event.fromPhone` digits.
- Update `getClientByWhatsappPhone` priority: `clients.whatsapp` → `whatsapp_contacts.linked_client_id` compatibility override → legacy `clients.phone` fallback.
- Update unit tests, migration contract test, and WhatsApp operator docs.

### Out of Scope
- Public UI changes for editing a separate WhatsApp field.
- Payment automation or arbitrary SQL/tool execution by the LLM.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `whatsapp-inbound-automation`: client resolution for dynamic tools uses CRM WhatsApp first while preserving safe fallback behavior.

## Approach
Make the database responsible for defaulting `clients.whatsapp` from `phone` on insert/update. Keep phone normalization in lookup code as digits-only to match webhook `fromPhone`. Ambiguous CRM or legacy matches remain non-answerable.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/` | New | Adds column, backfill, trigger, expression index. |
| `src/lib/ai/tools/travelhub-client-tools.ts` | Modified | Reorders and hardens lookup. |
| `src/lib/ai/__tests__/travelhub-client-tools.test.ts` | Modified | Adds lookup priority/regression tests. |
| `doc/whatsapp-simulated-inbound-tests.md` | Modified | Documents CRM field setup. |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Duplicate CRM WhatsApp values | Med | Return `ambiguous`; do not query trips. |
| Format mismatch | Med | Normalize with digits-only comparison and index. |

## Rollback Plan
Revert code/tests/docs and apply a rollback migration dropping the trigger, function, index, and `clients.whatsapp` column if necessary.

## Dependencies
- Existing issue #218 dynamic tool orchestration.
- Issue #221 has `status:approved` and `type:feature`.

## Success Criteria
- [ ] Sender matching `clients.whatsapp` resolves without `whatsapp_contacts.linked_client_id`.
- [ ] Blank/null `whatsapp` defaults from `phone` in DB.
- [ ] Lookup is indexed and ambiguous/no-match cases stay safe.
