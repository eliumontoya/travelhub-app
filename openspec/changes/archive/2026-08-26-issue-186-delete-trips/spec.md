# Spec Delta: Trip deletion

## Amendments to `trip-itinerary`

### Requirement: Trip deletion

The system MUST let the authenticated agent permanently delete a trip from the dashboard trip editor only after confirming the exact trip title. After successful deletion, the system MUST navigate away from the deleted trip to a safe dashboard route. Deleting a trip MUST remove its related trip-scoped rows according to the schema/domain cascade model in both Supabase and mock modes.

#### Scenario: Agent deletes a trip after confirmation

- GIVEN an authenticated agent is viewing `/dashboard/trips/{id}`
- AND the agent enters the exact trip title in the delete confirmation
- WHEN the agent submits the delete action
- THEN the trip is permanently removed from the database
- AND the agent is redirected to `/dashboard`

#### Scenario: Confirmation mismatch prevents deletion

- GIVEN an authenticated agent is viewing `/dashboard/trips/{id}`
- WHEN the submitted confirmation does not exactly match the current trip title
- THEN the trip MUST NOT be deleted
- AND the agent remains able to view the trip

#### Scenario: Related trip data is removed

- GIVEN a trip has days, items, assigned clients, tags, packing items, photos, documents, feedback, and status history
- WHEN the trip is deleted
- THEN trip-scoped related rows MUST no longer be returned for that trip
- AND unrelated clients and other trips MUST remain intact

#### Scenario: Mock mode mirrors Supabase deletion semantics

- GIVEN Supabase is not configured
- WHEN the agent deletes a trip
- THEN the in-memory mock data removes the trip and its trip-scoped related data for the current session
