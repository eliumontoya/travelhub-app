# Tasks: WhatsApp inbound agent decisioning (issue #201)

## Explore / design

- [x] Read required repo docs and issue context.
- [x] Read linked issue #200 context and decide stacked/unblocked path.
- [x] Read current OpenSpec specs and #199 migration.
- [x] Create issue #201 OpenSpec proposal/spec/design/tasks.

## TDD / implementation

- [x] Add RED unit tests for approved knowledge auto-answer.
- [x] Add RED unit tests for insufficient knowledge escalation.
- [x] Add RED unit tests for sensitive/commercial-specific escalation.
- [x] Add RED unit tests for malformed/unsafe provider output validation.
- [x] Implement side-effect-free decisioning module and knowledge retrieval.

## Verification / archive / PR

- [x] Run focused tests.
- [x] Run `npx tsc --noEmit`.
- [x] Run `npm run lint`.
- [x] Run `npm run test`.
- [x] Run `npm run build`.
- [x] Merge delta into `openspec/specs/whatsapp-inbound-automation/spec.md`.
- [x] Archive change folder.
- [x] Commit, push, and open stacked PR linked to #201/#198 and dependent on #200.
