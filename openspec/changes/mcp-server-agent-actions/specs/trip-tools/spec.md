# Delta for Trip Tools

## ADDED Requirements

These tools wrap `src/lib/data.ts` trip functions and are exposed only through the MCP server (see the `mcp-server` capability). Authentication failures are governed by the MCP server authentication requirement (HTTP `401`). Invalid-input errors are rejected by the tool's Zod schema before `data.ts` is reached; not-found errors return a structured tool error.

MCP tools for trips SHALL expose the agent-only fields `internalNotes`, `salePrice`, and `commissionRate` (per the `mcp-server` internal-field policy). These fields are never exposed to the public `/t/[slug]` or `/c/[slug]` paths.

**Status transition decision:** This change adopts the proposal's recommendation of a single `update_trip` tool carrying a `status` field (`draft` | `published` | `archived`) rather than separate `publish_trip` / `archive_trip` / `move_trip_status` tools. No divergence from the proposal.

### Requirement: list_trips

The `list_trips` tool SHALL return a paginated, filtered trip list. Key inputs: `page?` (number), `pageSize?` (number), and optional filters `query?`, `status?`, `currency?`, `clientId?`, `tagId?`, `startDate?`, `endDate?`. Success result: `{ items: Trip[], totalCount: number }`.

#### Scenario: Returns a filtered, paginated trip list

- GIVEN trips exist in various statuses
- WHEN `list_trips` is called with `{ status: "published" }`
- THEN the result contains only published trips and `totalCount`

### Requirement: get_trip

The `get_trip` tool SHALL return the full trip graph. Key inputs: `id` (string, required) — resolved by id (the tool may also accept `slug` in design). Success result: `TripWithDetails` (clients, tags, days, items, documents, photos, packing, status history, and `internalNotes`). If no trip matches, the tool SHALL return a not-found error.

#### Scenario: Returns the full trip graph

- GIVEN a trip with days and items exists
- WHEN `get_trip` is called with its id
- THEN the result includes clients, tags, days, items, and internal notes

#### Scenario: Unknown id returns not-found

- GIVEN no trip matches the supplied id
- WHEN `get_trip` is called
- THEN the tool returns a not-found error

### Requirement: create_trip

The `create_trip` tool SHALL create a trip requiring at least one client, with an auto-generated slug. Key inputs: `clientIds` (string[], required, min 1), `title` (string, required), `startDate?`, `endDate?`, `instructions?`, `travelerCount?`, `tagIds?` (string[]), `currency?` (`MXN`|`USD`|`EUR`), `isTemplate?` (boolean). Success result: the created `Trip` with `id`, generated `slug`, and timestamps. An empty `clientIds` array is rejected by the schema.

#### Scenario: Creates a trip with at least one client

- GIVEN a valid `title` and one `clientId` are supplied
- WHEN `create_trip` is called
- THEN a `Trip` is created and returned with a generated `slug`

#### Scenario: Missing client is rejected

- GIVEN the call supplies an empty `clientIds` array
- WHEN the tool validates input
- THEN the call is rejected with a validation error

### Requirement: create_trip_from_template

The `create_trip_from_template` tool SHALL instantiate a new trip from a template (copies days/items without documents). Key inputs: `templateId` (string, required), `title?`, `clientIds?` (string[]), `startDate?`, `endDate?`. Success result: the created `Trip`. If the template id does not exist, the tool SHALL return a not-found error.

#### Scenario: Instantiates a trip from a template

- GIVEN a template trip exists with days and items
- WHEN `create_trip_from_template` is called with its id and a `clientIds`
- THEN a new `Trip` is returned with the template's days and items copied (no documents)

#### Scenario: Unknown template returns not-found

- GIVEN no template matches the supplied id
- WHEN `create_trip_from_template` is called
- THEN the tool returns a not-found error

### Requirement: update_trip (single tool, includes status)

The `update_trip` tool SHALL edit trip metadata AND status in one tool. Key inputs: `id` (string, required) and any of `title?`, `slug?`, `startDate?`, `endDate?`, `coverImageUrl?`, `instructions?`, `travelerCount?`, `budget?` (`number|null`), `status?` (`draft`|`published`|`archived`), `currency?`, `showCostsToClient?` (boolean), `salePrice?` (`number|null`), `commissionRate?` (`number|null`). Success result: the updated `Trip` (including internal fields). If the id does not exist, the tool SHALL return a not-found error. This single tool replaces any separate publish/archive tools.

#### Scenario: Updates metadata and publishes in one call

- GIVEN a draft trip exists
- WHEN `update_trip` is called with `{ status: "published", salePrice: 1500 }`
- THEN the returned `Trip` has `status: "published"` and `salePrice: 1500`

#### Scenario: Unknown id returns not-found

- GIVEN no trip matches the supplied id
- WHEN `update_trip` is called
- THEN the tool returns a not-found error

### Requirement: set_trip_clients

The `set_trip_clients` tool SHALL assign a trip's clients using diff semantics, requiring at least one. Key inputs: `tripId` (string, required), `clientIds` (string[], required, min 1). Success result: an acknowledgement (e.g. `{ success: true }`). An empty list is rejected by the schema.

#### Scenario: Replaces a trip's client set

- GIVEN a trip has clients `[A]`
- WHEN `set_trip_clients` is called with `clientIds: [B, C]`
- THEN the trip's clients become `[B, C]`

#### Scenario: Empty client list is rejected

- GIVEN the call supplies an empty `clientIds` array
- WHEN the tool validates input
- THEN the call is rejected with a validation error

### Requirement: set_trip_tags

The `set_trip_tags` tool SHALL assign a trip's tags (diff semantics). Key inputs: `tripId` (string, required), `tagIds` (string[], required). Success result: an acknowledgement.

#### Scenario: Sets trip tags

- GIVEN a trip exists
- WHEN `set_trip_tags` is called with `tagIds: ["x", "y"]`
- THEN the trip's tags are set to `[x, y]`

### Requirement: save_trip_as_template

The `save_trip_as_template` tool SHALL save an existing trip as a template (`is_template = true`). Key inputs: `tripId` (string, required), `title` (string, required). Success result: the created template `Trip`. If the source trip does not exist, the tool SHALL return a not-found error.

#### Scenario: Saves a trip as a template

- GIVEN a trip exists
- WHEN `save_trip_as_template` is called with a `title`
- THEN a new `Trip` with `isTemplate: true` is returned

### Requirement: list_templates

The `list_templates` tool SHALL list all template trips. Key inputs: none required. Success result: an array of `Trip` where `isTemplate` is true.

#### Scenario: Returns template trips

- GIVEN template trips exist
- WHEN `list_templates` is called
- THEN the result contains only `isTemplate: true` trips

### Requirement: add_trip_day

The `add_trip_day` tool SHALL add a day to a trip. Key inputs: `tripId` (string, required), `date` (string, required, ISO date), `notes?`, `sortOrder?` (number). Success result: the created `TripDay`.

#### Scenario: Adds a trip day

- GIVEN a valid `tripId` and `date` are supplied
- WHEN `add_trip_day` is called
- THEN a `TripDay` is created and returned

#### Scenario: Missing date is rejected

- GIVEN the call omits `date`
- WHEN the tool validates input
- THEN the call is rejected with a validation error

### Requirement: update_trip_day

The `update_trip_day` tool SHALL edit a day's date and/or notes. Key inputs: `id` (string, required), `date?` (ISO date), `notes?`, `sortOrder?` (number). Success result: the updated `TripDay`. If the id does not exist, the tool SHALL return a not-found error.

#### Scenario: Updates a day's notes

- GIVEN a trip day exists
- WHEN `update_trip_day` is called with new `notes`
- THEN the returned `TripDay` reflects the new `notes`

#### Scenario: Unknown id returns not-found

- GIVEN no trip day matches the supplied id
- WHEN `update_trip_day` is called
- THEN the tool returns a not-found error

### Requirement: delete_trip_day

The `delete_trip_day` tool SHALL soft-delete a day (sets `deleted_at`). Key inputs: `id` (string, required). Success result: an acknowledgement. If the id does not exist, the tool SHALL return a not-found error.

#### Scenario: Soft-deletes a trip day

- GIVEN a trip day exists
- WHEN `delete_trip_day` is called
- THEN the day is soft-deleted and an acknowledgement is returned

### Requirement: restore_trip_day

The `restore_trip_day` tool SHALL restore a soft-deleted day. Key inputs: `id` (string, required). Success result: an acknowledgement. If the id does not exist, the tool SHALL return a not-found error.

#### Scenario: Restores a trip day

- GIVEN a soft-deleted trip day exists
- WHEN `restore_trip_day` is called
- THEN the day becomes active again and an acknowledgement is returned

### Requirement: generate_trip_days

The `generate_trip_days` tool SHALL fill a trip's days from its start/end dates (creating missing days and reordering chronologically). Key inputs: `tripId` (string, required). Success result: a generation result (e.g. `{ created: number, days: TripDay[] }`). If the trip has no start/end dates, the tool SHALL return an error.

#### Scenario: Generates days from start/end

- GIVEN a trip with start and end dates but no days
- WHEN `generate_trip_days` is called
- THEN the returned result includes the created days covering the date range

#### Scenario: Missing date range returns an error

- GIVEN a trip without start/end dates
- WHEN `generate_trip_days` is called
- THEN the tool returns an error

### Requirement: reorder_trip_days

The `reorder_trip_days` tool SHALL reorder days via `sort_order` swap. Key inputs: `order` (array of `{ id: string, sortOrder: number }`, required, min 1). Success result: an acknowledgement.

#### Scenario: Reorders days

- GIVEN two trip days exist
- WHEN `reorder_trip_days` is called with swapped `sortOrder` values
- THEN the days are reordered and an acknowledgement is returned

### Requirement: add_item

The `add_item` tool SHALL add an item with type-specific metadata. Key inputs: `tripDayId` (string, required), `type` (`flight`|`hotel`|`activity`|`restaurant`|`transport`|`note`, required), `title` (string, required), `startTime?`, `endTime?`, `location?`, `lat?`, `lng?`, `confirmationCode?`, `notes?`, `cost?` (number), `sortOrder?`, `supplierId?`, `metadata?` (record). Success result: the created `Item`. Invalid `type` or missing required fields are rejected by the schema.

#### Scenario: Adds an item

- GIVEN valid `tripDayId`, `type`, and `title` are supplied
- WHEN `add_item` is called
- THEN an `Item` is created and returned

#### Scenario: Invalid type is rejected

- GIVEN the call supplies a `type` outside the allowed enum
- WHEN the tool validates input
- THEN the call is rejected with a validation error

### Requirement: update_item

The `update_item` tool SHALL edit an item (all fields except `tripDayId`). Key inputs: `id` (string, required), plus any of the `add_item` fields except `tripDayId`. Success result: the updated `Item`. If the id does not exist, the tool SHALL return a not-found error.

#### Scenario: Updates an item's title

- GIVEN an item exists
- WHEN `update_item` is called with a new `title`
- THEN the returned `Item` reflects the new `title`

#### Scenario: Unknown id returns not-found

- GIVEN no item matches the supplied id
- WHEN `update_item` is called
- THEN the tool returns a not-found error

### Requirement: delete_item

The `delete_item` tool SHALL soft-delete an item. Key inputs: `id` (string, required). Success result: an acknowledgement. If the id does not exist, the tool SHALL return a not-found error.

#### Scenario: Soft-deletes an item

- GIVEN an item exists
- WHEN `delete_item` is called
- THEN the item is soft-deleted and an acknowledgement is returned

### Requirement: restore_item

The `restore_item` tool SHALL restore a soft-deleted item. Key inputs: `id` (string, required). Success result: an acknowledgement. If the id does not exist, the tool SHALL return a not-found error.

#### Scenario: Restores an item

- GIVEN a soft-deleted item exists
- WHEN `restore_item` is called
- THEN the item becomes active again and an acknowledgement is returned

### Requirement: move_item

The `move_item` tool SHALL move an item to another day. Key inputs: `itemId` (string, required), `targetDayId` (string, required). Success result: an acknowledgement. If either id does not exist, the tool SHALL return a not-found error.

#### Scenario: Moves an item to another day

- GIVEN an item and a target day exist
- WHEN `move_item` is called
- THEN the item is associated with the target day and an acknowledgement is returned

### Requirement: duplicate_item

The `duplicate_item` tool SHALL duplicate an item, optionally into a target day. Key inputs: `itemId` (string, required), `targetDayId?` (string). Success result: the newly created `Item` (copy). If the source id does not exist, the tool SHALL return a not-found error.

#### Scenario: Duplicates an item

- GIVEN an item exists
- WHEN `duplicate_item` is called
- THEN a new `Item` copy is returned

### Requirement: reorder_items

The `reorder_items` tool SHALL reorder items via `sort_order` swap. Key inputs: `order` (array of `{ id: string, sortOrder: number }`, required, min 1). Success result: an acknowledgement.

#### Scenario: Reorders items

- GIVEN two items exist
- WHEN `reorder_items` is called with swapped `sortOrder` values
- THEN the items are reordered and an acknowledgement is returned

### Requirement: add_packing_item

The `add_packing_item` tool SHALL add a packing checklist item. Key inputs: `tripId` (string, required), `label` (string, required), `sortOrder?` (number). Success result: the created `PackingItem`.

#### Scenario: Adds a packing item

- GIVEN valid `tripId` and `label` are supplied
- WHEN `add_packing_item` is called
- THEN a `PackingItem` is created and returned

#### Scenario: Missing label is rejected

- GIVEN the call omits `label`
- WHEN the tool validates input
- THEN the call is rejected with a validation error

### Requirement: update_packing_item

The `update_packing_item` tool SHALL edit a packing item (including toggling checked). Key inputs: `id` (string, required), `label?`, `checked?` (boolean). Success result: the updated `PackingItem`. If the id does not exist, the tool SHALL return a not-found error.

#### Scenario: Toggles a packing item as checked

- GIVEN a packing item exists
- WHEN `update_packing_item` is called with `checked: true`
- THEN the returned `PackingItem` has `checked: true`

#### Scenario: Unknown id returns not-found

- GIVEN no packing item matches the supplied id
- WHEN `update_packing_item` is called
- THEN the tool returns a not-found error

### Requirement: delete_packing_item

The `delete_packing_item` tool SHALL remove a packing item. Key inputs: `id` (string, required). Success result: an acknowledgement. If the id does not exist, the tool SHALL return a not-found error.

#### Scenario: Deletes a packing item

- GIVEN a packing item exists
- WHEN `delete_packing_item` is called
- THEN the item is removed and an acknowledgement is returned

### Requirement: get_trip_internal_notes

The `get_trip_internal_notes` tool SHALL read a trip's internal notes (agent-only). Key inputs: `id` (string, required). Success result: `{ internalNotes: string | null }`. This field is exposed only via MCP and never to `/t/[slug]`. If the trip does not exist, the tool SHALL return a not-found error.

#### Scenario: Returns internal notes

- GIVEN a trip has internal notes
- WHEN `get_trip_internal_notes` is called
- THEN the result contains those `internalNotes`

### Requirement: update_trip_internal_notes

The `update_trip_internal_notes` tool SHALL write a trip's internal notes (agent-only). Key inputs: `id` (string, required), `internalNotes` (string | null, required). Success result: an acknowledgement. This field is exposed only via MCP and never to `/t/[slug]`. If the trip does not exist, the tool SHALL return a not-found error.

#### Scenario: Writes internal notes

- GIVEN a trip exists
- WHEN `update_trip_internal_notes` is called with a value
- THEN the notes are persisted and an acknowledgement is returned

### Requirement: get_document_upload_url

The `get_document_upload_url` tool SHALL return a short-lived pre-signed Supabase Storage PUT URL so the agent uploads document bytes directly (the actual `upload_*` storage tools are deferred). Key inputs: `path` (string, required — the Storage object path, e.g. `trips/{id}/...` or `clients/{id}/...`). Success result: `{ uploadUrl: string, expiresIn?: number }`. If Supabase Storage is unconfigured or the path is invalid, the tool SHALL return an error.

#### Scenario: Returns a pre-signed upload URL

- GIVEN Supabase Storage is configured
- WHEN `get_document_upload_url` is called with a valid `path`
- THEN the result contains a `uploadUrl` the agent can PUT bytes to directly

#### Scenario: Missing path is rejected

- GIVEN the call omits `path`
- WHEN the tool validates input
- THEN the call is rejected with a validation error
