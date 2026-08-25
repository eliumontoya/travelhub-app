# Spec: move-item-to-day

## Overview

Allow an agent to reassign an existing itinerary item to another day of the same
trip without deleting and recreating it.

## Requirements

### Requirement 1: Reassign item to a different day

The system SHALL provide a way to change the `trip_day_id` of an existing item
to another day of the same trip, preserving all other item fields (title, type,
times, location, cost, notes, metadata, supplier, documents linkage).

#### Scenario: Move item to another day
- **Given** a trip with day A and day B, each containing at least one item
- **When** the agent reassigns an item from day A to day B
- **Then** the item is removed from day A's list
- **And** the item appears at the end of day B's list
- **And** the item's title, type, times, location, cost, notes, metadata and supplier are unchanged

#### Scenario: Reassigned item reflected in public view
- **Given** an item reassigned from day A to day B in the dashboard
- **When** the public view `/t/[slug]` is rendered
- **Then** the item is shown under day B, not day A

### Requirement 2: Destination day selection

The UI SHALL present a list of the trip's days (excluding the item's current day)
so the agent can pick the destination day.

#### Scenario: Current day excluded from choices
- **Given** an item currently on day A
- **When** the agent opens the move-to-day control
- **Then** day A is not offered as a destination

### Requirement 3: Dual-mode support

The reassignment SHALL work identically in mock mode (no Supabase configured)
and Supabase mode.

#### Scenario: Mock mode
- **Given** the app running without Supabase env vars
- **When** the agent reassigns an item to another day
- **Then** the change persists for the session and renders correctly

## Acceptance Scenarios

- Moving an item updates both the source and destination day lists immediately
  after revalidation.
- No item field other than `trip_day_id` and `sort_order` is modified.
- The action fails closed (no-op) if `targetDayId` is empty or equals the
  current day.
