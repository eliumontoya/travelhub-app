# Exploration: Supplier Google Badge (issue #188)

## Issue

`/dashboard/suppliers` should visually mark suppliers that were found or enriched through Google and have a Google Maps/Places identifier.

## Current State

- `Supplier.googlePlaceId` already exists in `src/types/index.ts`.
- `getSuppliers()` returns `googlePlaceId` from mock and Supabase data through `rowToSupplier()`.
- Google Places capture/enrichment from issues #171/#172 persists `googlePlaceId` as the durable signal that a supplier came from Google Places.
- `/dashboard/suppliers` renders supplier rows in `src/app/dashboard/suppliers/catalog-client.tsx`.

## Relevant Next.js Docs Read

- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`

## Constraints

- No schema or data-layer change is needed.
- The badge must degrade gracefully: suppliers without `googlePlaceId` should render as they do today.
- The catalog is already a Client Component for filters/dialog state, so a small presentational badge can be rendered there without changing route boundaries.
