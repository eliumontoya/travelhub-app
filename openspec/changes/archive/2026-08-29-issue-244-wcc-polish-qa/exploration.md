## Exploration: WCC Polish, Empty States, Links, Responsive QA

### Current State
WCC already has dashboard, contacts, escalations, conversations, and knowledge routes. Most pages render safely without Supabase, but navigation active state is hardcoded, dashboard cards do not consistently link to detail pages, table headers remain visible on mobile, and empty states are inconsistent/action-light.

### Affected Areas
- `src/app/dashboard/wcc/layout.tsx` — WCC nav active/available state.
- `src/app/dashboard/wcc/page.tsx` — dashboard final-chain copy, section links, recent record links, empty states.
- `src/app/dashboard/wcc/contacts/**` — contact empty states and related conversation links.
- `src/app/dashboard/wcc/conversations/**` — mobile headers, safe states, linked client/contact exits.
- `src/app/dashboard/wcc/escalations/page.tsx` — mobile headers and cross-link to related conversation/contact.
- `src/app/dashboard/wcc/knowledge/**` — consistent safe empty/not-found states.
- `doc/features/**` — concise WCC operational documentation.
- `e2e/wcc-polish.spec.ts` — navigation and responsive smoke coverage.

### Approaches
1. **Route-local polish helpers** — Add small WCC-local components for notices, empty states, links, and active nav.
   - Pros: Consistent UX with low blast radius; no app-wide design-system churn.
   - Cons: Some duplication remains outside WCC.
   - Effort: Low.
2. **Global design-system refactor** — Extract generic dashboard components and migrate WCC pages.
   - Pros: Stronger reuse long-term.
   - Cons: Too large for QA/polish issue and risks unrelated regressions.
   - Effort: High.

### Recommendation
Use route-local polish helpers and targeted page updates. This closes navigability, empty-state, and mobile-readability gaps without adding major WCC features or altering data semantics.

### Risks
- Client nav component could accidentally pull server code into the browser; avoid importing server helpers from it.
- E2E checks may hit auth redirects in configured environments; tests should skip safely when login is shown.

### Ready for Proposal
Yes — scope is narrow and matches issue #244.
