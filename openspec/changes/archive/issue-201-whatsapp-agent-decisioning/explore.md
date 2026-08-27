# Explore: WhatsApp inbound agent decisioning (issue #201)

## Context

Issue #201 adds the side-effect-free decisioning phase for the WhatsApp inbound agent under epic #198. It depends on #199 data foundation and #200 webhook ingestion.

## Startup / dependency check

- Issue #200 PR: https://github.com/eliumontoya/travelhub-app/pull/205
- State at startup: `OPEN`, not merged into `main`.
- Decision: stack this branch on `origin/feat/issue-200-whatsapp-webhook-ingestion` because #201 depends on #200's webhook/types/spec baseline and implementing from `origin/main` would be stale.
- Final PR must target the #200 branch and explicitly document that it should be retargeted/rebased to `main` after PR #205 merges.

## Inputs read

- `AGENTS.md`, `project.md`, `architecture.md`
- Issue #201 and epic #198 bodies from GitHub
- Linked issue #200 context/transcript via nodeterm linked-context CLI
- `openspec/config.yaml`
- `openspec/specs/whatsapp-inbound-automation/spec.md`
- `openspec/specs/crm-sync-staging/spec.md` for context only
- `supabase/migrations/20260826194451_whatsapp_inbound_data_foundation.sql`
- Supabase/Postgres best-practices skill and relevant query/RLS references

## Missing input

`doc/whatsapp-inbound-agent-architecture.md` is still absent in this stacked worktree. The implementation uses the GitHub issue bodies, #199/#200 specs, and migration as the source of truth.

## Existing baseline

- `whatsapp_knowledge_entries` stores `topic`, `question`, `answer`, `tags`, `source`, `status`, and `approved_at`.
- Existing spec says only approved knowledge MAY be used by future agents.
- #200 added webhook ingestion but explicitly excludes LLM/decisioning and side effects beyond persistence.

## Design constraints discovered

- Keep decisioning side-effect-free: no message writes, intent writes, escalation writes, outbound WhatsApp sends, or route mutation.
- Use dependency injection for the model call so unit tests do not require an OpenAI key or network.
- If no model/API key/provider is available, return a conservative `needs_human` result.
- Before invoking model logic, block obvious sensitive or commercial-specific cases that require a human travel agent.
- Validate structured model output; invalid JSON, invalid enums, low confidence, or answers that cannot cite approved knowledge escalate.
