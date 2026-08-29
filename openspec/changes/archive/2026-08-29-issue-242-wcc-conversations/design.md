# Design: WCC Grouped Conversations View

## Overview
Add PR 4/6 WCC slice as read-only conversations grouped at the thread level. Keep messages contextual inside detail only, preserving the product decision not to create a raw message inbox.

## Data Access
- `getWccConversationsList({ page })` validates page input and queries `whatsapp_conversations` with `count: "exact"`, ordered by `last_message_at desc nulls last` then `created_at desc`.
- Contact context loads once via `.in("id", contactIds)`.
- Latest inbound/outbound snippets and latest intents load in bounded batch queries by `conversation_id`, ordered newest first, grouped in application code to avoid N+1 queries.
- `getWccConversationDetail(id)` loads one conversation, its contact, recent messages, and recent intents with bounded ranges.
- Supabase unconfigured returns mock-safe empty states; configured read errors return unavailable states.

## UI
- `/dashboard/wcc/conversations` reads promise-based `searchParams` per Next 16 docs, renders row/card links grouped by conversation id, and paginates.
- `/dashboard/wcc/conversations/[id]` reads promise-based `params`, renders contact summary, status/activity metadata, message timeline, and intent context.
- WCC nav links to conversations route; no `/dashboard/wcc/messages` route or menu item is introduced.

## Non-goals
- No reply composer or manual response action.
- No conversation status mutation or assignment controls.
- No knowledge CRUD and no webhook/bot/orchestration changes.
- No schema changes; existing indexes cover conversation ordering and message/intent grouping.

## Verification
Run focused Vitest for the helper, then TypeScript, lint, full unit tests, build, and e2e smoke.
