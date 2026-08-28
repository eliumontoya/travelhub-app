## Exploration: issue #223 client WhatsApp form field

### Current State
Issue #221 already added `clients.whatsapp`, `clients.whatsapp_normalized`, a trigger that copies `phone` into `whatsapp` when WhatsApp is blank, and dynamic-tool lookup priority based on normalized WhatsApp. The data layer already accepts `CreateClientInput.whatsapp`, maps `row.whatsapp` into `Client.whatsapp`, and mock creation defaults `whatsapp` from `phone`; however, the dashboard client forms do not render or submit a WhatsApp input. `updateClientAction` only sends `phone`, so Supabase can fill blank WhatsApp via the trigger, but explicit WhatsApp editing is impossible from the UI and mock updates do not currently mirror the DB auto-copy behavior unless the action passes the desired fallback value.

### Affected Areas
- `src/app/dashboard/clients/[id]/page.tsx` — add an editable WhatsApp field near `Teléfono`, defaulting from `client.whatsapp`.
- `src/app/dashboard/clients/[id]/actions.ts` — read `whatsapp` from `FormData` and save `whatsapp || phone` so the UI/action contract matches the issue in both Supabase and mock modes.
- `src/app/dashboard/clients/actions.ts` — update shared create action to accept `whatsapp` and default it from `phone` when blank for create surfaces that post to this action.
- `src/app/dashboard/trips/new/actions.ts` and `src/components/NewTripForm.tsx` — optional if “formulario de clientes” includes inline new-client creation while creating a trip; add `newClientWhatsapp` or rely on data-layer/DB fallback from `newClientPhone`.
- `src/components/TripClientsManager.tsx` — optional inline client creation currently has only name/email and submits empty phone, so no WhatsApp value is available there.
- `src/lib/data.ts` — likely no Supabase change needed; consider adding mock-mode fallback on update when `whatsapp` is blank and `phone` is present if the action does not normalize.
- `src/lib/__tests__/data.test.ts` and/or client action tests — cover create/update fallback and explicit WhatsApp preservation.
- `openspec/specs/client-crm/spec.md` — add/modify client record requirements to include optional WhatsApp and blank-field fallback.

### Approaches
1. **Normalize in Server Actions** — Add WhatsApp inputs to client forms and have actions persist `whatsapp || phone`.
   - Pros: Minimal code, matches the user-visible save behavior, works in Supabase and mock mode without changing the existing migration.
   - Cons: Fallback logic lives partly above the data layer; non-form callers must remember the convention.
   - Effort: Low.

2. **Normalize in `src/lib/data.ts`** — Add WhatsApp inputs to forms but centralize fallback in `createClient`/`updateClient` before mock/Supabase branching.
   - Pros: One app-level contract for all callers and mock mode mirrors Supabase trigger behavior.
   - Cons: Must avoid overwriting explicit existing WhatsApp on phone-only updates; update needs either existing-row awareness or action-level presence semantics.
   - Effort: Medium.

3. **Rely only on the database trigger** — Add UI field and pass raw `whatsapp`, letting Supabase copy phone when blank.
   - Pros: Preserves the DB source of truth from issue #221.
   - Cons: Mock mode diverges; tests without Supabase may not prove the requested fallback; explicit behavior depends on the deployed migration.
   - Effort: Low.

### Recommendation
Use Approach 1 for the issue #223 implementation, with a small data-layer/mock test if needed. Add the WhatsApp input to the client detail edit form, submit `whatsapp`, and compute `const whatsapp = rawWhatsapp || phone || undefined` in client create/update actions. For the main new-trip inline client form, either add a `newClientWhatsapp` field for consistency or explicitly document that blank WhatsApp falls back from `newClientPhone`; no new Supabase migration should be needed because issue #221 already shipped the columns, normalized helper, trigger, and partial index.

### Risks
- If the user clears WhatsApp while phone remains populated, the requested rule means the saved WhatsApp will become the phone value; this should be explicit in UI helper text to avoid surprise.
- If only the detail form is updated, inline client creation from new-trip flows will still lack an explicit WhatsApp field even though fallback from phone works.
- Duplicated fallback rules between DB trigger and server actions can drift; tests should cover both explicit WhatsApp preservation and blank WhatsApp copy-from-phone in mock/action behavior.
- Existing client list/export currently show only email/phone; decide in proposal whether WhatsApp should appear there or remain detail-only.

### Ready for Proposal
Yes — scope is bounded to client CRM UI/actions/tests/specs, with no new database migration required unless verification finds production missing the issue #221 migration.
