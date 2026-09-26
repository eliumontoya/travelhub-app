# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Travel agent:** organizes client records, builds daily itineraries, manages documents, publishes trips, and follows up on travel details from the authenticated workspace.
- **Traveler:** reviews a published itinerary from a shareable link, finds trip information on a phone, and can add activities or the whole trip to a personal calendar.

## Product Purpose

TravelHub gives an independent travel agent an owned workspace for creating, managing, and sharing complete itineraries. It replaces the operational dependency on third-party itinerary platforms and scattered client communications with a single product the agent controls.

Success means a trip can move from client record to an organized, shareable itinerary without forcing the traveler to create an account, while preserving a useful travel history for the agent.

## Positioning

TravelHub combines the agent's internal trip workspace with a public, client-specific itinerary at a unique URL. The public experience is tied directly to the agent's published trip data rather than a generic document or a separate itinerary service.

## Operating Context

The agent works in a browser to manage clients, trips, day-by-day itinerary items, confirmations, documents, suppliers, and settings. Travelers typically consult a published itinerary from a shared link, often on mobile, during trip planning or travel.

## Capabilities and Constraints

- Authenticated agent routes are protected by Supabase Auth; public `/t/[slug]` routes expose only published trips through Row Level Security.
- The product supports clients, trips, trip days, itinerary items, documents, sharing, calendar export, optional maps, flight-status lookup, email reminders, and feedback.
- Supabase/Postgres and private storage are used when configured; an in-memory mock mode keeps the core application runnable without a Supabase account.
- Server Components are the default. Interactive traveler controls and forms use client components only when browser APIs or local state require them.

## Brand Commitments

The product is named **HUBit by TravelHub**. Its interface should make dense travel operations feel clear, trustworthy, and composed without obscuring itinerary details or actions.

## Evidence on Hand

- Business purpose and workflows: `project.md`.
- Technical architecture and access boundaries: `architecture.md`.
- Current global visual tokens: `src/app/globals.css`.
- Current shared UI primitives and traveler surfaces: `src/components/ui/`, `src/app/client/`, and `src/app/t/[slug]/`.

## Product Principles

1. Keep trip information centralized, structured, and ready to share.
2. Preserve a clear boundary between the agent's private workspace and the traveler's public itinerary.
3. Make itinerary details easy to scan on the device where they are needed.
4. Degrade optional integrations gracefully so core trip management remains available.
5. Prefer owned workflows and data over dependency on a third-party itinerary platform.

## Accessibility & Inclusion

The web experience uses semantic interactive controls and visible focus treatment. New surfaces must preserve keyboard navigation, readable contrast, responsive layouts, and Spanish-language travel information where supplied by the product.
