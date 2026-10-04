# Feature: issue-399-knip-dead-code

Issue: https://github.com/eliumontoya/travelhub-app/issues/399
Branch: `eliumontoya/chore-limpiar-62-issues-de-dead-code-knip-4-arch`
Status: approved (label `status:approved`), type:chore

## Goal

Reduce knip dead-code issues from 62 to ≤10 so `npm run sanity` reports deadCode as ✅/⚠️.
No behavior changes: deletions only, plus knip config and dependency declaration fixes.

## Baseline (verified 2026-07, knip JSON in this worktree)

- 4 unused files (no refs, no dynamic imports — verified by grep)
- 1 unlisted dependency: `chat` (type-only import in `agent/channels/whatsapp.ts:3`;
  `chat@4.40.0` is a direct dep of `@chat-adapter/whatsapp`)
- 1 unlisted binary: `supabase` (provided by global CLI)
- ~20 unused exports, ~34 unused exported types

## Tasks

### T1. Delete 4 unused files
- [ ] src/components/ClientCombobox.tsx
- [ ] src/components/CreateClientDialog.tsx
- [ ] src/app/dashboard/DashboardExplorer.tsx
- [ ] src/lib/supabase/client.ts (verified: no dynamic imports, no refs from scripts/ or SSR)
Evidence: grep across src/scripts/agent/e2e found zero references outside the files themselves.

### T2. Dependency + knip config
- [ ] Add `"chat": "^4.40.0"` to `package.json` dependencies (matches @chat-adapter/whatsapp 4.40.0)
- [ ] Add `"supabase"` to `ignoreDependencies` in `knip.json`

### T3. Remove ~20 unused exports
Rule: if the symbol is referenced elsewhere in its own file, remove only the `export`
keyword; if fully unused, delete the symbol (and its private helpers if they become unused).
- [ ] src/lib/item-meta.ts: normalizeClientNames
- [ ] src/components/LocationMap.tsx: LocationMap (check if component unused → consider file deletion)
- [ ] src/app/dashboard/trips/[id]/actions.ts: markUploadProcessedAction, getServicesWithChecklistsForTripAction
- [ ] src/lib/item-metadata-schemas.ts: 5 schemas (flight/hotel/activity/restaurant/transport)
- [ ] src/lib/wcc-contacts.ts: WCC_CONTACTS_PAGE_SIZE
- [ ] src/lib/wcc-conversations.ts: WCC_CONVERSATIONS_PAGE_SIZE, WCC_CONVERSATION_TIMELINE_LIMIT
- [ ] src/lib/wcc-escalations.ts: WCC_ESCALATIONS_PAGE_SIZE
- [ ] src/lib/wcc-knowledge.ts: WCC_KNOWLEDGE_PAGE_SIZE, WccKnowledgeValidationError, normalizeWccKnowledgeStatus
- [ ] src/lib/constants.ts: MAX_UPLOAD_MB
- [ ] src/lib/whatsapp/inbound-service.ts: processWhatsAppStatusEvents
- [ ] src/lib/whatsapp/store.ts: upsertWhatsAppContact, getOrCreateOpenWhatsAppConversation
- [ ] src/lib/mcp/tools/utils.ts: textResult

### T4. Remove ~34 unused exported types
Same rule: de-export if referenced internally; delete if fully unused.
- [ ] src/types/index.ts: ActivityMetadata, RestaurantMetadata, TransportMetadata, ItemMetadata,
      FlightItem, HotelItem, ActivityItem, RestaurantItem, TransportItem, NoteItem, JsonRecord,
      CrmSyncEventStatus, WhatsAppContact, WhatsAppConversation, WhatsAppMessage, WhatsAppIntent,
      WhatsAppEscalation, CrmSyncEvent
- [ ] src/lib/wcc-contacts.ts: WccLinkedClient, WccContactRow, WccConversationContext, WccEscalationContext, WccIntentContext
- [ ] src/lib/wcc-conversations.ts: WccConversationContact
- [ ] src/lib/wcc-escalations.ts: WccEscalationContact, WccEscalationConversation
- [ ] src/lib/whatsapp/inbound-service.ts: WhatsAppInboundEventResult
- [ ] src/lib/item-supplier-compatibility.ts: SupplierEnabledItemType
- [ ] src/lib/wcc-dashboard.ts: WccRecentConversation, WccRecentContact
- [ ] src/lib/ai/tools/travelhub-client-tools.ts: TravelHubClientToolName, TravelHubToolAudit
- [ ] src/lib/ai/whatsapp-inbound-agent.ts: WhatsAppInboundIntent, WhatsAppInboundDecisionType, WhatsAppInboundAgentDiagnostics

### T5. Verification
- [ ] `npx knip --reporter json` → total issues ≤10
- [ ] `npm test` green
- [ ] `npm run build` no errors
- [ ] Work-unit commit(s), Conventional Commit

## Non-goals

- No refactors, no behavior changes, no renames beyond deletion/de-export.
- Not touching Eve-migration logic beyond removing dead exports.

## Evidence / commits

- `4e2a43b` chore(knip): delete 4 unused files
- `1e03207` chore(knip): declare chat dependency and ignore supabase binary
- `34deb45` chore(knip): remove unused exports and exported types

## Verification results (2026-07, this worktree)

- `npx knip --reporter json`: 62 → **0 issues**
- `npm test`: 804/804 passed (111 files)
- `npm run build`: green (with local .env.copy; prerender requires Supabase env)
- `npm run lint`: 0 errors, 16 warnings (`no-unused-vars` on the de-exported
  WhatsApp/Crm types in src/types/index.ts, pinned by
  src/__tests__/whatsapp-data-foundation.test.ts; rule is "warn" in
  eslint-config-next, pre-existing pattern)

## Deviations from the original plan

- `supabase` binary goes in `ignoreBinaries` (knip's correct key), not
  `ignoreDependencies`.
- `LocationMap.tsx` file kept: sibling export `LocationActions` has 3 live
  consumers; only the unused `LocationMap` component was removed.
- The 6 WhatsApp/Crm types in src/types/index.ts were de-exported, not deleted:
  pinned by name in a contract test outside the change scope.
- `chat` is a regular dependency of @chat-adapter/whatsapp@4.40.0; declared at
  ^4.40.0 and package-lock.json synced.
