---
name: HUBit by TravelHub
description: A composed travel-operations workspace with clear traveler itineraries.
colors:
  canvas: "#fdf7f3"
  surface: "#ffffff"
  surface-raised: "#fffafb"
  surface-subtle: "#f8e8ef"
  ink: "#40142c"
  ink-muted: "#76596a"
  border: "#eadde3"
  brand: "#65003d"
  brand-strong: "#4e002f"
  accent: "#f0bd79"
  action-foreground: "#ffffff"
typography:
  body:
    fontFamily: "Geist, Arial, Helvetica, sans-serif"
  mono:
    fontFamily: "Geist Mono, monospace"
rounded:
  control: "0.75rem"
  card: "0.875rem"
  panel: "1rem"
spacing:
  compact: "0.5rem"
  standard: "1rem"
  comfortable: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.action-foreground}"
    rounded: "{rounded.control}"
  button-primary-hover:
    backgroundColor: "{colors.brand-strong}"
    textColor: "{colors.action-foreground}"
    rounded: "{rounded.control}"
  surface-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
---

# Design System: HUBit by TravelHub

## Overview

**Creative North Star: "The Considered Travel Desk"**

HUBit uses a warm, editorial workspace character to make travel operations feel organized rather than clinical. Pale blush canvas layers, white working surfaces, and a restrained wine accent create a calm hierarchy for data-rich agent workflows and traveler itineraries.

The system is operational first: titles, dates, statuses, confirmations, and actions must remain easy to find. The traveler experience extends the same visual language with lighter reading rhythm and direct trip actions, without becoming a separate brand.

**Key Characteristics:**
- Warm neutral surfaces with a focused wine action color.
- Compact, scan-friendly operational layouts with generous grouping.
- Consistent rounded controls and softly elevated cards.
- Clear keyboard focus and contrast-aware semantic states.

## Colors

The palette uses warmth to organize information, not to decorate every surface.

### Primary
- **Travel Wine:** the durable action and emphasis color for primary controls, active states, and focal data.
- **Deep Travel Wine:** the stronger interaction state for primary actions.

### Secondary
- **Golden Route Accent:** a sparing highlight for selected details, progress, and celebratory trip moments; it must retain legible dark foreground text.

### Neutral
- **Paper Canvas:** the warm page background that separates application regions.
- **Working Surface:** the white base for cards, forms, and data panels.
- **Blush Layer:** the subtle grouping surface for secondary context.
- **Plum Ink:** the primary reading color for headings and important trip data.
- **Muted Plum:** the supporting text color for metadata and hints.
- **Soft Border:** the restrained divider between related operational elements.

**The Focused Accent Rule.** Use the primary wine for the action that advances the current task; do not turn every label, icon, or border into an accent.

## Typography

**Display Font:** Geist (with Arial and Helvetica fallbacks)
**Body Font:** Geist (with Arial and Helvetica fallbacks)
**Label/Mono Font:** Geist Mono (with monospace fallback)

**Character:** A precise sans-serif system for fast reading of names, dates, travel details, and form labels. Hierarchy comes from weight, scale, spacing, and color contrast instead of decorative typefaces.

### Hierarchy
- **Page titles:** strong, high-contrast Geist headings for route identity and trip names.
- **Section titles:** medium-to-strong headings that group itinerary or operational information.
- **Body and metadata:** readable regular text, with muted ink reserved for secondary context.
- **Codes and confirmations:** mono typography when values benefit from fixed-width scanning.

## Layout

Use a warm canvas around discrete surfaces. Agent workflows favor compact, responsive columns that preserve a clear action area and readable data groups. Traveler pages prioritize a single-column mobile reading path, then add width and supporting structure at larger viewports.

Keep related itinerary details together: date, time, location, confirmation, and traveler actions should be visually adjacent. Preserve whitespace between groups rather than using heavy borders to simulate hierarchy.

## Elevation & Depth

Cards and panels use soft, low-opacity plum shadows to distinguish working layers from the canvas. Elevation is ambient, not dramatic: raised surfaces should clarify grouping and focus, never mimic floating marketing cards.

**The Quiet Depth Rule.** Prefer a surface change or soft shadow before adding multiple borders, gradients, or competing decorative treatments.

## Shapes

Controls use a 0.75rem radius; cards use 0.875rem; larger panels use 1rem. Corners should feel consistently soft and practical across forms, buttons, data cards, and itinerary sections.

Borders are light and structural. Focus states use the semantic focus color with an offset so keyboard movement remains visible on both light and dark themes.

## Components

- **Primary actions:** wine backgrounds with white text; use the stronger wine only for hover or active feedback.
- **Secondary actions:** surface or ghost treatment with readable plum text and clear border/focus behavior.
- **Operator surfaces:** reusable card and panel primitives define the shared grouping vocabulary for agent and traveler views.
- **Itinerary activity controls:** retain the shared action language while respecting the public page's simpler reading flow.
- **Theme controls:** preserve the semantic token system in light and dark modes; never hard-code colors that bypass the tokens.

## Do's and Don'ts

### Do's
- Use the semantic `--operator-*` tokens and shared UI primitives before inventing one-off colors or radii.
- Make the primary action singular and obvious within its task context.
- Preserve public itinerary readability and mobile-first spacing.
- Use visible focus treatment and semantic foreground/background pairings.

### Don'ts
- Do not revive the obsolete operator-login visual world or attach the system to one route.
- Do not replace the shared token vocabulary with arbitrary blue/gray defaults.
- Do not hide trip-critical details behind decorative treatments or hover-only affordances.
- Do not use hard-coded colors where an existing semantic token expresses the intent.
