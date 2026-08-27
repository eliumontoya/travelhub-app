# Delta for Supplier Tools

## ADDED Requirements

These tools wrap `src/lib/data.ts` supplier functions and are exposed only through the MCP server (see the `mcp-server` capability). Authentication failures are governed by the MCP server authentication requirement (HTTP `401`). Invalid-input errors are rejected by the tool's Zod schema before `data.ts` is reached; not-found errors return a structured tool error. Soft-deleted suppliers are excluded from list/get results.

### Requirement: list_suppliers

The `list_suppliers` tool SHALL return a paginated, filtered supplier catalog. Key inputs: `page?` (number), `pageSize?` (number), `query?` (string), `type?` (string), `tag?` (string). Success result: `{ items: Supplier[], totalCount: number }`, excluding soft-deleted suppliers. Invalid pagination/filter types are rejected by the schema.

#### Scenario: Returns a filtered, paginated catalog

- GIVEN suppliers exist with various types and tags
- WHEN `list_suppliers` is called with `{ query: "Hotel", type: "hotel" }`
- THEN the result contains matching, non-deleted suppliers and `totalCount`

#### Scenario: Soft-deleted suppliers are excluded

- GIVEN a supplier was soft-deleted
- WHEN `list_suppliers` is called
- THEN that supplier does not appear in `items`

### Requirement: get_supplier

The `get_supplier` tool SHALL return a single supplier by id. Key inputs: `id` (string, required). Success result: the `Supplier` object. If the id does not exist (or the supplier is soft-deleted), the tool SHALL return a not-found error.

#### Scenario: Returns the requested supplier

- GIVEN a non-deleted supplier with a known id exists
- WHEN `get_supplier` is called with that id
- THEN the result is the matching `Supplier`

#### Scenario: Unknown or deleted id returns not-found

- GIVEN no active supplier matches the supplied id
- WHEN `get_supplier` is called
- THEN the tool returns a not-found error

### Requirement: create_supplier

The `create_supplier` tool SHALL create a supplier. Key inputs: `name` (string, required), `type` (string, required), `contactPhone?`, `contactEmail?`, `website?`, `address?`, `lat?` (number), `lng?` (number), `notes?`, `tags?` (string[]). Success result: the created `Supplier` with `id` and timestamps. Missing `name` or `type` is rejected by the schema.

#### Scenario: Creates a supplier

- GIVEN a valid `name` and `type` are supplied
- WHEN `create_supplier` is called
- THEN a `Supplier` is created and returned with a stable `id`

#### Scenario: Missing required field is rejected

- GIVEN the call omits `type`
- WHEN the tool validates input
- THEN the call is rejected with a validation error

### Requirement: update_supplier

The `update_supplier` tool SHALL edit supplier fields. Key inputs: `id` (string, required), plus any of `name?`, `type?`, `contactPhone?`, `contactEmail?`, `website?`, `address?`, `lat?`, `lng?`, `notes?`, `tags?`. Success result: the updated `Supplier`. If the id does not exist, the tool SHALL return a not-found error.

#### Scenario: Updates editable fields

- GIVEN a supplier exists
- WHEN `update_supplier` is called with a changed `website`
- THEN the returned `Supplier` reflects the new `website`

#### Scenario: Unknown id returns not-found

- GIVEN no supplier matches the supplied id
- WHEN `update_supplier` is called
- THEN the tool returns a not-found error

### Requirement: delete_supplier

The `delete_supplier` tool SHALL soft-delete a supplier. Key inputs: `id` (string, required), `force?` (boolean). Success result: an acknowledgement (e.g. `{ success: true }`). If the supplier is referenced by items and `force` is not `true`, the tool SHALL return an error explaining the reference constraint. If the id does not exist, the tool SHALL return a not-found error.

#### Scenario: Soft-deletes an unreferenced supplier

- GIVEN a supplier not referenced by any item
- WHEN `delete_supplier` is called
- THEN the supplier is soft-deleted and the acknowledgement is returned

#### Scenario: Referenced supplier without force is rejected

- GIVEN a supplier referenced by at least one item
- WHEN `delete_supplier` is called without `force`
- THEN the tool returns an error and the supplier remains active

#### Scenario: Unknown id returns not-found

- GIVEN no supplier matches the supplied id
- WHEN `delete_supplier` is called
- THEN the tool returns a not-found error

### Requirement: restore_supplier

The `restore_supplier` tool SHALL restore a soft-deleted supplier. Key inputs: `id` (string, required). Success result: an acknowledgement (e.g. `{ success: true }`). If the id does not exist, the tool SHALL return a not-found error.

#### Scenario: Restores a soft-deleted supplier

- GIVEN a soft-deleted supplier exists
- WHEN `restore_supplier` is called
- THEN the supplier becomes active again and an acknowledgement is returned
