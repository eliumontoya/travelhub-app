# Design: Client WhatsApp Form Field

## Technical Approach

Implement the issue as an App Router form/action change over the existing client CRM data model. No Supabase migration is needed: `clients.whatsapp`, `clients.whatsapp_normalized`, and the database blank-to-phone trigger already exist from issue #221. Server Actions will still compute fallback values so mock mode and Supabase mode share the same user-visible contract.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Fallback layer | Compute `whatsapp || phone` in client Server Actions. | Rely only on DB trigger; centralize all fallback in `data.ts`. | Actions receive form intent directly and can make mock/Supabase behavior match with minimal risk. |
| UI scope | Add WhatsApp to client detail and new-trip inline creation. | Detail-only. | Issue says client form; inline new-client creation is also a client form path. |
| Migration | No new migration. | Add another schema migration. | Existing issue #221 migration already covers columns, normalized helper, trigger, and index. |

## Data Flow

```text
Client form/new-trip form
  └─ FormData(phone, whatsapp)
      └─ Server Action computes effectiveWhatsapp = whatsapp || phone
          └─ src/lib/data.ts createClient/updateClient
              ├─ Supabase: clients.whatsapp saved; DB trigger normalizes
              └─ Mock: Client.whatsapp stored for local behavior
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/dashboard/clients/[id]/page.tsx` | Modify | Add WhatsApp input with helper text. |
| `src/app/dashboard/clients/[id]/actions.ts` | Modify | Read and pass effective WhatsApp during update. |
| `src/app/dashboard/clients/actions.ts` | Modify | Read and pass effective WhatsApp during create. |
| `src/components/NewTripForm.tsx` | Modify | Add optional new-client WhatsApp field. |
| `src/app/dashboard/trips/new/actions.ts` | Modify | Persist effective WhatsApp for inline new clients. |
| `src/lib/__tests__/data.test.ts` | Modify | Add mock-mode fallback/preservation tests. |
| `openspec/changes/issue-223-client-whatsapp-form/*` | Create/Modify | SDD artifacts. |
| `openspec/specs/client-crm/spec.md` | Modify at archive | Sync updated requirement. |
| `eslint.config.mjs` | Modify | Ignore local tooling/worktree directories so repo-wide lint completes. |

## Interfaces / Contracts

`CreateClientInput.whatsapp?: string` already exists. Actions should normalize empty strings to `undefined` except when computing fallback:

```ts
const phone = String(formData.get("phone") ?? "").trim();
const whatsapp = String(formData.get("whatsapp") ?? "").trim() || phone || undefined;
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Blank WhatsApp copies phone on create/update in mock mode. | Extend `src/lib/__tests__/data.test.ts`. |
| Unit | Explicit WhatsApp remains distinct from phone. | Extend `src/lib/__tests__/data.test.ts`. |
| Build | App Router forms/actions typecheck. | `npx tsc --noEmit`, lint, build. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary is changed by the product implementation.

## Migration / Rollout

No migration required for this change. Roll out with code deploy after issue #221 DB migration is present in the target Supabase database.

## Open Questions

- [ ] Should client list/CSV include WhatsApp in a future enhancement? Not required for issue #223.
