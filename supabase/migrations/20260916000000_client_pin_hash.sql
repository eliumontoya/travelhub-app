-- Per-client authentication PIN (issue #302).
-- Nullable bcrypt hash; plaintext PINs are never stored.
-- Read/write happens server-side only via service role, never through anon RLS.

alter table clients add column if not exists pin_hash text;
