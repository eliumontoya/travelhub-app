# Runtime Architecture Diagram

## Objective
Create a high-level runtime architecture diagram for TravelHub that communicates the dominant authenticated itinerary workflow without turning the diagram into a dependency spiderweb.

## Problem
The repository contains a documented Next.js + Supabase runtime with public and authenticated surfaces plus optional integrations, but the existing text overview does not show trust boundaries or a single primary path.

## Scope
- Analyze the current repository and reconcile `project.md`, `architecture.md`, and implementation evidence.
- Produce one high-level diagram with 8–12 core runtime components.
- Show one primary path, external dependencies, and trust boundaries.
- Put supporting component detail in cards/notes rather than adding more graph edges.
- Do not change application source or runtime behavior.

## Authorized scope
- Read repository documentation and implementation.
- Add architecture-documentation artifacts under `docs/` and this ODD task record.
- Do not modify application code, configuration, migrations, or deployment settings.

## Checklist
- [x] T1 — Reconcile runtime components and boundaries from repository evidence. Evidence: `project.md`, `architecture.md`, CodeGraph exploration, and read-only explorer handoff.
- [x] T2 — Create the high-level runtime architecture diagram and supporting cards. Artifact: `docs/runtime-architecture.md`.
- [x] T3 — Read back the artifact and verify component count, primary path, dependencies, and boundaries. `git diff --check` passed.

## Acceptance criteria
- Diagram names 8–12 core runtime components.
- Diagram makes one primary authenticated publish/share path visually dominant.
- External dependencies are explicit and labeled optional/server-only where applicable.
- Trust boundaries are explicit for public clients, Vercel/Next.js runtime, Supabase, and third-party providers.
- Supporting detail is placed in cards/notes and does not create additional graph edges.
- Artifact is grounded in repository paths and does not claim an API/server that the codebase does not have.

## Applicable checks
- Structural readback of the generated Markdown/Mermaid artifact.
- Confirm `git diff --check` is clean for the artifact.
- No application test run is required because runtime source is unchanged.

## Progress
- Route: direct inline for documentation artifact; repository structure was explored with CodeGraph before authoring.
- TDD: not applicable; no executable behavior is changed.
- Tool note: an `archify` executable/skill was not available in this runtime; use the closest available architecture artifact format and disclose that limitation.

## Verification evidence
- Read back `docs/runtime-architecture.md` after writing.
- Diagram contains 12 core components, one solid primary path, two bounded dotted relationships, explicit trust-boundary subgraphs, and external-dependency cards.
- `git diff --check -- odd/tasks/runtime-architecture-diagram.md docs/runtime-architecture.md` passed.
- No application source or runtime behavior changed.
- Work-unit commit: `fa8768f` (`docs: add runtime architecture diagram`).

## Next step
None for this documentation slice; future work may reconcile the documented architecture drift called out in the artifact.
