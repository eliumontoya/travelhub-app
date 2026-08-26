# Design: WhatsApp webhook ingestion (issue #200)

## D1 — Thin route handler

`src/app/api/whatsapp/webhook/route.ts` owns only HTTP concerns: query parameter verification, JSON parsing, calling the normalizer, calling the store, and mapping known errors to status codes.

## D2 — Pure normalizer

`src/lib/whatsapp/normalize.ts` has no side effects. It accepts unknown JSON, walks all `entry[].changes[]`, and returns one normalized event per inbound `messages[]` item. Unsupported message types are returned with `body` absent and raw data preserved.

## D3 — Service-role webhook writes

`src/lib/whatsapp/store.ts` creates a server-only Supabase client from `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. This is separate from browser/SSR anon clients because #199 WhatsApp tables are private and webhook writes are machine-to-machine.

## D4 — Idempotency by provider id

The store first upserts the contact by `phone_e164`, then obtains/creates an open conversation for the contact, then inserts `whatsapp_messages`. Message insert uses Supabase upsert with `onConflict: "whatsapp_message_id"` and `ignoreDuplicates: true` so the database unique constraint resolves duplicate webhook retries atomically.

## D5 — No signature validation in this phase

Only Meta verify-token GET validation is implemented. `WHATSAPP_APP_SECRET` and `X-Hub-Signature-256` validation are deferred to a later reliability/security issue to avoid implementing security-sensitive behavior without consulting current official Meta docs.

## D6 — Test strategy

- Unit tests for `normalizeWhatsAppWebhookPayload` cover text and unsupported message payloads.
- Route tests call exported `GET`/`POST` handlers directly with `NextRequest` and mock `@/lib/whatsapp/store`.
- Store tests mock Supabase client chains to verify upsert/insert behavior and duplicate acknowledgement without a live database.
