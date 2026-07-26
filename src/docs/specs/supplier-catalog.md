# Supplier Catalog Specification

**Change**: issue-114-supplier-catalog
**Type**: Full spec (new domain) + delta (modified Item/data layer)

## Purpose

Centralize supplier information (hotels, tour operators, transport companies, restaurants) so agents reference, not repeat, supplier data across trips — reducing input overhead and consistency errors.

---

## ADDED Requirements

### R1: Supplier CRUD

The system MUST support Create, Read, Update, Delete (soft delete with restore) for suppliers with the following fields: name (required), type (`hotel | tour_operator | transport | restaurant | other`), contactPhone, contactEmail, website, address, lat, lng, notes, tags. A dual mock/Supabase data layer MUST mirror the existing Client CRUD pattern.

#### Scenario: Create supplier

- GIVEN the agent opens the create supplier dialog
- WHEN they fill required field "name" and select type "hotel"
- THEN a new supplier is created with a unique ID, and it appears in the supplier list

#### Scenario: Soft delete and restore

- GIVEN a supplier with no items referencing it
- WHEN the agent deletes the supplier
- THEN the supplier is soft-deleted (deletedAt set) and hidden from the active list
- WHEN the agent restores it (undo toast)
- THEN the supplier reappears in the active list

#### Scenario: Delete supplier referenced by items

- GIVEN a supplier referenced by one or more items
- WHEN the agent attempts to delete it
- THEN the system MUST warn the agent that items reference this supplier
- AND the delete MUST be blocked unless the agent confirms (cascading nullifies supplier_id on items)

#### Scenario: Duplicate supplier name

- GIVEN a supplier named "Sunset Beach Resort" exists
- WHEN the agent creates another supplier also named "Sunset Beach Resort"
- THEN the creation succeeds (name is not unique; suppliers are distinguished by ID)

#### Scenario: Update supplier fields

- GIVEN a supplier with phone "+521234567890"
- WHEN the agent updates the phone to "+529876543210"
- THEN the supplier's phone is updated and the updatedAt timestamp advances

### R2: Supplier Catalog Page

The system MUST provide a `/dashboard/suppliers/` route with a table listing all active (non-deleted) suppliers, searchable by name, filterable by type and tags. It MUST include a create/edit dialog and delete with undo toast.

#### Scenario: Search by name

- GIVEN suppliers named "Ritz", "Four Seasons", "Hostel Central"
- WHEN the agent types "ritz" in the search box
- THEN only "Ritz" appears in the table

#### Scenario: Filter by type

- GIVEN suppliers of types hotel, restaurant, and transport
- WHEN the agent selects type filter "hotel"
- THEN only hotel-type suppliers appear

#### Scenario: Filter by tags

- GIVEN suppliers tagged "luxury" and "budget"
- WHEN the agent selects tag filter "luxury"
- THEN only suppliers tagged "luxury" appear

#### Scenario: Empty search results

- GIVEN no supplier names match the search query "zzzzz"
- WHEN the agent submits the search
- THEN the table shows "No suppliers found" with a suggestion to adjust filters

#### Scenario: Empty catalog (no suppliers exist)

- GIVEN no suppliers have been created yet
- WHEN the agent navigates to `/dashboard/suppliers/`
- THEN the page shows an empty state with a "Create first supplier" button

#### Scenario: Delete with undo toast

- GIVEN an active supplier
- WHEN the agent clicks delete
- THEN the supplier is soft-deleted and an undo toast appears
- WHEN the agent clicks "Undo" within the toast timeout
- THEN the supplier is restored to the active list

### R3: Supplier Combobox (ItemFormDialog integration)

The ItemFormDialog MUST include a searchable combobox to select an existing supplier. Selecting a supplier of type "hotel" MUST auto-fill the item type to "hotel" (and similarly for "restaurant" and "transport"). The combobox MUST show the selected supplier's name, address, and phone.

#### Scenario: Select existing supplier

- GIVEN suppliers "Sunset Beach Resort" (hotel) and "La Mesa" (restaurant)
- WHEN the agent opens the item form and searches "sunset" in the supplier combobox
- THEN "Sunset Beach Resort" appears as a selectable option

#### Scenario: Auto-fill item type from supplier

- GIVEN the agent selects supplier "Sunset Beach Resort" (type: hotel)
- WHEN the supplier is selected in the combobox
- THEN the item type dropdown auto-selects "hotel"

#### Scenario: No suppliers exist

- GIVEN no suppliers have been created
- WHEN the agent opens the supplier combobox
- THEN the combobox shows an empty state with a "Create supplier" option

#### Scenario: Show selected supplier details

- GIVEN supplier "Sunset Beach Resort" with address "123 Beach Rd" and phone "+521234567890"
- WHEN the agent selects it in the combobox
- THEN the combobox displays the name, address, and phone underneath the selected value

### R4: Quick-Add Supplier

The supplier combobox MUST include an option to create a new supplier inline. After successful creation, the newly created supplier MUST be automatically selected in the combobox.

#### Scenario: Quick-add from combobox

- GIVEN the item form is open and no matching supplier exists for "New Hotel"
- WHEN the agent clicks "Create supplier" in the combobox dropdown
- THEN a CreateSupplierDialog opens inline
- WHEN the agent fills name "New Hotel" and type "hotel" and submits
- THEN the supplier is created and automatically selected in the combobox
- AND the item type auto-fills to "hotel"

#### Scenario: Cancel quick-add

- GIVEN the CreateSupplierDialog is open from the combobox
- WHEN the agent clicks cancel without saving
- THEN the dialog closes
- AND the combobox remains in its previous state with no change

#### Scenario: Quick-add with minimal fields

- GIVEN the agent creates a supplier via quick-add with only "name" filled
- WHEN the agent submits
- THEN the supplier is created with default/empty values for all other fields

### R5: Public Supplier Display

On the public trip view (`/t/[slug]/`), when an item references a supplier, the supplier's name and address MUST be displayed. The address SHOULD optionally link to Google Maps.

#### Scenario: Item references a supplier

- GIVEN a published trip with an item referencing supplier "Sunset Beach Resort" (address: "123 Beach Rd")
- WHEN the client views `/t/[slug]`
- THEN the item card displays "Sunset Beach Resort" and "123 Beach Rd"
- AND the address links to Google Maps (`https://maps.google.com/?q=123+Beach+Rd`)

#### Scenario: Item has no supplier

- GIVEN a published trip with an item that has no `supplierId`
- WHEN the client views `/t/[slug]`
- THEN the item card renders normally without any supplier section

#### Scenario: Supplier deleted after item references it

- GIVEN an item references a supplier that was subsequently soft-deleted
- WHEN the client views `/t/[slug]`
- THEN the item still shows the supplier's name and address from the snapshot (the FK is maintained; only the catalog hides deleted suppliers)

### R6: Data Migration

The system MUST include migration `0028_suppliers.sql` that creates the `suppliers` table (with RLS enabled, same mono-user pattern as existing tables), adds a nullable `supplier_id` column to `items`, and seeds 3–5 sample suppliers across different types.

#### Scenario: Migration runs cleanly

- GIVEN the database has migrations up to 0027 applied
- WHEN migration 0028 runs
- THEN the `suppliers` table is created with all required columns
- AND `supplier_id` column (nullable FK) is added to `items`
- AND 3–5 sample suppliers are inserted

#### Scenario: Existing items unchanged

- GIVEN items existed before the migration
- WHEN migration 0028 runs
- THEN all existing items retain their data with `supplier_id = NULL`

---

## MODIFIED Requirements

### M1: Item Type — Supplier Extension

The `Item` interface MUST include an optional `supplierId` field of type `string`. When the item type is `hotel`, `restaurant`, or `transport`, the ItemFormDialog MUST render the supplier combobox. (Previously: Item had no supplierId; ItemFormDialog had no supplier selector.)

#### Scenario: Item created with supplier

- GIVEN the agent is creating an item of type "hotel"
- WHEN they select a supplier from the combobox
- THEN the item is created with `supplierId` set to the selected supplier's ID

#### Scenario: Item created without supplier (type matches)

- GIVEN the agent is creating an item of type "hotel"
- WHEN they leave the supplier combobox empty
- THEN the item is created with `supplierId = undefined` (backward compatible)

#### Scenario: Non-matching item type

- GIVEN the agent is creating an item of type "flight" or "note" or "activity"
- WHEN the form renders
- THEN the supplier combobox is NOT shown

#### Scenario: Supplier combobox appears for matching types

- GIVEN the agent selects item type "restaurant" or "transport"
- WHEN the form renders
- THEN the supplier combobox appears (same behavior as "hotel")

### M2: Data Layer — Supplier CRUD Functions

The data layer (`src/lib/data.ts`) MUST export the following functions following the existing dual mock/Supabase pattern: `CreateSupplierInput` type, `rowToSupplier` mapper, `getSuppliers(params)`, `getSupplierById(id)`, `createSupplier(input)`, `updateSupplier(id, input)`, `softDeleteSupplier(id)`, `restoreSupplier(id)`. (Previously: no supplier functions existed in the data layer.)

#### Scenario: getSuppliers returns paginated results

- GIVEN 10 suppliers exist
- WHEN getSuppliers({ page: 1, pageSize: 5 }) is called
- THEN it returns 5 suppliers with totalCount = 10

#### Scenario: createSupplier works in mock mode

- GIVEN Supabase is not configured
- WHEN createSupplier({ name: "Test Hotel", type: "hotel" }) is called
- THEN a new supplier is added to the mock array with a generated ID and timestamps

#### Scenario: getSupplierById returns null for unknown ID

- GIVEN no supplier with ID "nonexistent-id"
- WHEN getSupplierById("nonexistent-id") is called
- THEN it returns null

---

## Coverage

| Area | Status |
|------|--------|
| Happy paths | Covered |
| Edge cases | Covered |
| Error states | Covered |
| Requirements | 6 added, 2 modified |
| Scenarios | 22 total (18 new + 4 carried forward) |
