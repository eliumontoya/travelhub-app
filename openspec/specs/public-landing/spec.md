# Public Landing Specification

## Purpose

Define the observable behavior of the public, unauthenticated root landing page (`/`) for HUBit by TravelHub. The landing replaces the prior root redirect to the authenticated agent dashboard with an institutional entry point that introduces the product and routes each audience — agents and travelers — to its own login.

## Requirements

### Requirement: Public unauthenticated root landing

The root route `/` MUST render a public landing page. It MUST NOT redirect visitors to `/dashboard` or any other authenticated route, and it MUST NOT require authentication to view.

#### Scenario: Anonymous visitor sees the landing

- GIVEN a visitor has no active session
- WHEN they open `/`
- THEN the public landing MUST render
- AND the visitor MUST NOT be redirected to `/dashboard` or prompted to authenticate

#### Scenario: Authenticated visitor still sees the landing

- GIVEN a visitor already has an authenticated agent session
- WHEN they open `/`
- THEN the landing MUST render without forcing a redirect to the dashboard

#### Scenario: No auth gate at the root

- GIVEN an unauthenticated visitor
- WHEN they request `/`
- THEN the server MUST return the landing page without any authentication challenge

### Requirement: Institutional branding

The landing MUST present institutional, informative branding for HUBit by TravelHub, identifying the product to first-time visitors.

#### Scenario: Brand is identifiable

- GIVEN a visitor opens `/`
- WHEN the landing renders
- THEN the HUBit by TravelHub brand MUST be visible
- AND the page MUST present institutional context about the product

### Requirement: Two-entry audience split

The landing MUST present exactly two entry CTAs in a center split. The LEFT entry MUST target the agent login and navigate to `/login`. The RIGHT entry MUST target the traveler login and navigate to `/client/login`.

#### Scenario: Both entries navigate correctly

- GIVEN a visitor is viewing the landing
- WHEN they activate the LEFT entry
- THEN they MUST be taken to `/login`
- AND when they activate the RIGHT entry, they MUST be taken to `/client/login`

#### Scenario: Exactly two entries

- GIVEN a visitor is viewing the landing
- WHEN the landing renders
- THEN exactly two audience entry points MUST be presented, and no third audience entry point MUST be shown

### Requirement: Distinct CTA labels per audience

The two CTA labels MUST be distinct and non-ambiguous between audiences, so an agent and a traveler can each identify the entry meant for them. The agent label MUST read "Acceder Agentes" in Spanish, and the traveler label MUST read "Ingresar Viajeros" in Spanish; each MUST have a correspondingly distinct, non-ambiguous English label.

#### Scenario: Spanish labels are distinct

- GIVEN the landing is rendered in Spanish
- WHEN the visitor reads the two CTAs
- THEN the agent label MUST read "Acceder Agentes"
- AND the traveler label MUST read "Ingresar Viajeros"
- AND the two labels MUST NOT be interchangeable between audiences

#### Scenario: English labels are distinct

- GIVEN the landing is rendered in English
- WHEN the visitor reads the two CTAs
- THEN the agent and traveler labels MUST be distinct and MUST clearly identify which audience each entry is for

### Requirement: Visually distinct entry sides

The two entry sides MUST be visually distinct from each other. At minimum, the distinction MUST be expressed through color treatment using the existing design tokens — a wine-toned accent for the agent side and a gold-toned accent for the traveler side. The distinction MUST NOT depend on any specific background image that has not been supplied.

Distinct background imagery per side MAY be used as an enhancement, but only when those assets are supplied; the spec MUST NOT require them.

#### Scenario: Color distinguishes the two sides

- GIVEN the landing is rendered
- WHEN the visitor views the two entry sides
- THEN the agent side MUST be visually distinct from the traveler side
- AND the distinction MUST be conveyed by the wine vs gold color treatment even without distinct imagery

#### Scenario: Distinction does not depend on imagery

- GIVEN no distinct per-side background images are supplied
- WHEN the landing renders
- THEN the two sides MUST still be visually distinct via color treatment

#### Scenario: Supplied imagery is an enhancement only

- GIVEN distinct agent and traveler background images are supplied
- WHEN the landing renders
- THEN the supplied imagery MAY be shown per side, in addition to the color distinction

### Requirement: Bilingual copy with Spanish default

All user-facing copy on the landing MUST be served from the translation dictionary and MUST NOT be hard-coded to a single language. The default language MUST be Spanish. The page MUST honor the `?lang=` query parameter, using `es` for Spanish and `en` for English, and MUST offer a language toggle.

#### Scenario: Default language is Spanish

- GIVEN a visitor opens `/` with no `?lang` parameter and no stored language preference
- WHEN the landing renders
- THEN all user-facing copy MUST appear in Spanish

#### Scenario: Explicit English selection

- GIVEN a visitor opens `/?lang=en`
- WHEN the landing renders
- THEN all user-facing copy MUST appear in English

#### Scenario: Explicit Spanish selection

- GIVEN a visitor opens `/?lang=es`
- WHEN the landing renders
- THEN all user-facing copy MUST appear in Spanish

#### Scenario: Unknown language falls back to Spanish

- GIVEN a visitor opens `/?lang=fr` (or any unsupported value)
- WHEN the landing renders
- THEN the page MUST fall back to the Spanish copy

#### Scenario: Toggling language updates the page

- GIVEN a visitor is viewing the landing
- WHEN they activate the language toggle to switch between Spanish and English
- THEN all user-facing copy MUST update to the selected language

#### Scenario: Missing translation never shows raw keys

- GIVEN a translation key is missing from a language dictionary
- WHEN the landing renders in that language
- THEN the page MUST fall back to the default-language value rather than rendering a raw translation key

### Requirement: Keyboard and accessible navigation

The two entry CTAs and the language toggle MUST be reachable and operable using only the keyboard, and MUST expose accessible names that identify their destination or function.

#### Scenario: Keyboard reaches both entries in order

- GIVEN a visitor uses only the keyboard
- WHEN they press Tab through the landing
- THEN focus MUST move to the two entry CTAs and the language toggle in a logical order
- AND each CTA MUST have an accessible name that identifies its audience and destination

#### Scenario: Keyboard activates an entry

- GIVEN focus is on an entry CTA
- WHEN the visitor presses Enter or Space
- THEN the CTA MUST navigate to its target login route

### Requirement: Dark-mode legibility and distinction

The landing MUST remain legible, and the two entry sides MUST remain visually distinct from each other, when rendered in dark mode.

#### Scenario: Dark mode preserves distinction

- GIVEN the application is in dark mode
- WHEN the visitor views the landing
- THEN both entry sides MUST remain legible
- AND the agent side MUST remain visually distinct from the traveler side
