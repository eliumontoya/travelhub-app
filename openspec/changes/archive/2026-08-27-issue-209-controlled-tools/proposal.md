# Proposal: Controlled TravelHub Data Tools for WhatsApp

## Intent
Allow the WhatsApp inbound agent to request dynamic TravelHub facts through safe, typed, auditable tools instead of direct Supabase access, SQL generation, or broad data exposure.

## Scope

### In Scope
- Add a server-side allowlisted tool module for client/trip lookup and safe summaries.
- Enforce client ownership for every trip-scoped lookup.
- Return structured outcomes for found, ambiguous, not found, blocked, unavailable, and error states.
- Record sanitized tool-call audit evidence in existing `crm_sync_events` when possible.
- Add unit tests for happy paths, ambiguity, ownership blocking, sensitive payment handling, and DB errors.

### Out of Scope
- Live LLM tool-call loop integration.
- New payment tables or final commercial payment policy.
- Customer-facing UI or proactive outbound messages.
- Signed document delivery.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `whatsapp-inbound-automation`: add controlled dynamic-data tool contracts usable by future WhatsApp agent orchestration.

## Approach
Create `src/lib/ai/tools/travelhub-client-tools.ts` with a service-role Supabase adapter, typed tool contracts, safe projection helpers, ownership guards, and `runTravelHubClientTool` router. Keep all queries code-authored and table-specific. Use `crm_sync_events` for audit, with no raw customer message body or secrets.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/ai/tools/` | New | Controlled TravelHub tool contracts and router. |
| `src/lib/ai/__tests__/` | New | Unit coverage for tool behavior and safety. |
| `openspec/specs/whatsapp-inbound-automation/spec.md` | Modified | Source-of-truth behavior after archive. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Overexposing private trip data | Medium | Small safe projections and ownership checks. |
| Payment answers become inaccurate | Medium | Return policy_required/needs_human until payment schema exists. |
| Audit writes break tool reads | Low | Audit failures are non-fatal. |

## Rollback Plan
Revert the branch/commit; no migrations are introduced.

## Dependencies
- Existing WhatsApp data foundation and TravelHub trip/client tables.
- Supabase service-role configuration server-side only.

## Success Criteria
- [ ] Tool router only runs allowlisted tools.
- [ ] Trip tools block non-owned trip IDs.
- [ ] Ambiguous/no-data/error cases return safe structured outcomes.
- [ ] Unit tests and build pass.
