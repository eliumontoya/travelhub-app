# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Travel agent:** organizes client records, builds daily itineraries, manages documents, publishes trips, and follows up on travel details from the authenticated workspace.
- **Traveler:** reviews a published itinerary from a shareable link, finds trip information on a phone, and can add activities or the whole trip to a personal calendar.

## Purpose and Positioning

Purpose and positioning live in `project.md` (Spanish business reference); this document does not restate them.

## Operating Context

The agent works in a browser to manage clients, trips, day-by-day itinerary items, confirmations, documents, suppliers, and settings. Travelers typically consult a published itinerary from a shared link, often on mobile, during trip planning or travel.

## Capabilities and Constraints

- Authenticated agent routes are protected by Supabase Auth; public `/t/[slug]` routes expose only published trips through Row Level Security.
- The product supports clients, trips, trip days, itinerary items, documents, sharing, calendar export, optional maps, flight-status lookup, email reminders, and feedback.
- Supabase/Postgres and private storage are used when configured; an in-memory mock mode keeps the core application runnable without a Supabase account.
- Server Components are the default. Interactive traveler controls and forms use client components only when browser APIs or local state require them.

## Brand Commitments

The product is named **HUBit by TravelHub**. Its interface should make dense travel operations feel clear, trustworthy, and composed without obscuring itinerary details or actions.

## Sources of Truth

Topic ownership follows the truth-source table in `README.md`. This document keeps only product scope: platform, users, operating context, capabilities and constraints, brand commitments, principles, and accessibility.

## Product Principles

1. Keep trip information centralized, structured, and ready to share.
2. Preserve a clear boundary between the agent's private workspace and the traveler's public itinerary.
3. Make itinerary details easy to scan on the device where they are needed.
4. Degrade optional integrations gracefully so core trip management remains available.
5. Prefer owned workflows and data over dependency on a third-party itinerary platform.

## Accessibility & Inclusion

The web experience uses semantic interactive controls and visible focus treatment. New surfaces must preserve keyboard navigation, readable contrast, responsive layouts, and Spanish-language travel information where supplied by the product.
