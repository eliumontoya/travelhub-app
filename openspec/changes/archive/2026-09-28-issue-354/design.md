# Design: Filter Itinerary Suppliers by Item Category

## Technical Approach

Introduce one pure domain module that maps itinerary item types to compatible supplier types and exposes compatibility/error helpers. The authenticated trip editor will use this contract to derive the supplier-enabled item types, filter the already-preloaded active supplier catalog, keep the selected supplier controlled by the item form, and seed quick creation with the mapped supplier type.

The trusted `createItem` and `updateItem` data-layer functions will enforce the same contract before mutating either mock memory or Supabase. Dashboard Server Actions and MCP tools remain adapters: they translate form/tool input into the data-layer contract and expose domain validation failures without duplicating the compatibility rules. This follows the existing App Router flow:

`Server Component → client dialog → Server Action → src/lib/data.ts facade → domain data module → mock/Supabase`.

No public traveler route changes are involved.

## Architecture Decisions

### Decision: Centralize compatibility in a pure domain module

**Choice**: Create `src/lib/item-supplier-compatibility.ts` with a typed `ItemType` to `SupplierType` mapping, lookup/predicate helpers, and a recognizable domain validation error.

**Alternatives considered**: Keep a component-local `Set`; duplicate mapping checks in UI, Server Actions, and MCP tools; place the mapping in `src/lib/constants.ts`.

**Rationale**: A component-local or duplicated rule can drift and cannot protect direct data-layer callers. A focused module keeps behavioral policy separate from unrelated upload constants while remaining importable from client and server code without persistence dependencies.

### Decision: Keep item type authoritative over supplier type

**Choice**: The selected item type determines the compatible supplier type. Selecting a supplier will no longer rewrite the item type. `ItemFormDialog` will own the selected supplier id and clear it only when the next item type is incompatible.

**Alternatives considered**: Preserve the current supplier-driven `autoFillType` behavior; remount the combobox on every category change; clear every selection on any type change.

**Rationale**: Supplier-driven type changes reverse the intended dependency and cannot represent `activity → tour_operator`. Remounting can accidentally restore the original default when the user switches away and back. Controlled parent state makes stale-id removal explicit while preserving a still-compatible selection.

### Decision: Filter the preloaded active catalog in the browser

**Choice**: Continue loading active suppliers once in `TripEditorPage`; `SupplierCombobox` filters that catalog by the required supplier type first and then by the normalized name query. Empty focus displays the complete compatible subset in a height-bounded, scrollable list.

**Alternatives considered**: Query the server on focus or keystrokes; keep the current eight-result slice; pre-filter on the Server Component for one initial item type.

**Rationale**: The page already loads at most `ALL_SUPPLIERS_PAGE_SIZE` (1,000) active suppliers. Client filtering avoids network latency and Server Action churn. The specification requires all compatible suppliers on empty focus, so visual bounding must use scrolling rather than result truncation.

### Decision: Enforce compatibility at the data-layer mutation boundary

**Choice**: Validate supplier existence, active status, and type inside `createItem` before insertion. For compatibility-relevant updates, resolve the current item first, derive the resulting `(itemType, supplierId)` pair, validate it, and only then mutate. `updateItem` will support `supplierId: string | null`, where `null` explicitly clears the relation and `undefined` means unchanged.

**Alternatives considered**: Validate only in dashboard Server Actions; validate independently in each caller; add a database trigger or schema constraint.

**Rationale**: `createItem` and `updateItem` are shared by dashboard, MCP, and internal callers, so they are the narrowest trusted boundary. Resulting-state validation is required for partial MCP updates. A database constraint cannot express the cross-table type mapping without a migration/trigger, which is outside this change.

### Decision: Preserve secret-safe MCP errors while exposing validation failures

**Choice**: Use an exported `ItemSupplierCompatibilityError` (or equivalent code/type guard) for expected business-rule failures. MCP item tools map only that known error to an actionable `mcpError` validation response; all other errors continue through `unexpectedError` sanitization.

**Alternatives considered**: Return the raw data-layer message for every MCP failure; map compatibility failures to the generic unexpected-error response; duplicate validation in Zod schemas.

**Rationale**: Raw errors can leak internal details, while a generic response does not satisfy the validation-error contract. Zod cannot validate an id against persisted supplier data or derive the resulting state of a partial update.

### Decision: Use native combobox semantics without adding a UI dependency

**Choice**: Extend the existing component with `role="combobox"`, `aria-expanded`, `aria-controls`, a `listbox`, option states, and Arrow Up/Down, Enter, and Escape handling. Keep current visual tokens and dialog styling.

**Alternatives considered**: Add a headless-combobox package; retain mouse-only buttons; redesign the supplier UI.

**Rationale**: The interaction is small enough to implement with existing React state, and adding a dependency would be disproportionate. This is an operational refinement, not a visual redesign.

## Data Flow

### Supplier discovery and selection

```text
TripEditorPage
  └─ preloads active suppliers (getSuppliers, max 1,000)
       └─ ItemFormDialog owns selectedType + selectedSupplierId
            ├─ getSupplierTypeForItem(selectedType)
            ├─ clears selectedSupplierId when incompatible
            └─ SupplierCombobox(requiredSupplierType, selectedSupplierId)
                 ├─ suppliers filtered by supplier type
                 ├─ empty query => all compatible suppliers
                 ├─ typed query => normalized-name subset
                 └─ quick-create => CreateSupplierDialog(defaultType)
```

On supplier selection, the existing title/location/metadata autofill remains, but it does not change the item type. A quick-created supplier is added to the dialog's in-memory supplier catalog and selected immediately, so it remains available if the user changes category again during the same form session.

### Trusted create

```text
Dashboard action or MCP add_item
  └─ createItem(input)
       ├─ no supplier => continue
       ├─ resolve supplier by id
       ├─ reject missing, deleted, supplier-free, or mismatched pair
       └─ insert into mockItems or Supabase items
```

### Trusted partial update

```text
Dashboard action or MCP update_item
  └─ updateItem(id, patch)
       ├─ if type/supplier unchanged => existing update path
       └─ otherwise resolve current item
            ├─ resultingType = patch.type ?? current.type
            ├─ resultingSupplierId:
            │    undefined => current.supplierId
            │    null      => no supplier
            │    string    => submitted supplier
            ├─ validate resulting pair before mutation
            └─ update mock item or Supabase row
```

The dashboard edit action sends `null` when the form has no supplier so a category switch can clear an existing database relation. Add actions continue omitting an empty supplier. MCP `update_item` accepts nullable `supplierId` for the same explicit-clear contract.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/item-supplier-compatibility.ts` | Create | Own the typed mapping, compatibility helpers, stable domain error, and type guard. |
| `src/components/ItemFormDialog.tsx` | Modify | Replace the local supplier-enabled set and supplier-driven type mutation; own controlled supplier selection, clear incompatible values, include activities, and preserve supplier autofill. |
| `src/components/SupplierCombobox.tsx` | Modify | Accept a required supplier type and controlled selection; show all compatible results on empty focus, normalize typed filtering, support keyboard/listbox semantics, and pass the type to quick-create. |
| `src/components/CreateSupplierDialog.tsx` | Modify | Add an optional typed `defaultType` used only for creation; editing continues to use the supplier's persisted type. |
| `src/app/dashboard/trips/[id]/actions.ts` | Modify | Preserve create semantics and pass `null` on edit when the supplier field is empty or absent so stale references are cleared. |
| `src/lib/data/trips.ts` | Modify | Validate create/resulting update compatibility before mock or Supabase mutation and support explicit nullable supplier clearing. |
| `src/lib/mcp/tools/items.ts` | Modify | Accept nullable `supplierId` for updates and map the known compatibility error to a safe validation response. |
| `src/lib/__tests__/item-supplier-compatibility.test.ts` | Create | RED tests for the mapping, supplier-free types, `other`, and domain error recognition. |
| `src/lib/__tests__/item-supplier-persistence.test.ts` | Create | RED tests for valid create, missing/deleted/mismatched suppliers, atomic rejected updates, resulting-state checks, and explicit clearing in mock mode plus the existing mocked Supabase seam. |
| `src/lib/__tests__/item-actions.test.ts` | Modify | Verify create omits an empty supplier and edit forwards `null` when selection is cleared. |
| `src/lib/mcp/tools/__tests__/items.test.ts` | Modify | Verify compatible dispatch, nullable clearing, validation-error mapping, and continued sanitization of unexpected errors. |
| `e2e/mock/supplier-item-compatibility.spec.ts` | Create | Exercise empty-focus disclosure, category filtering, accent-insensitive search, quick-create default, and stale-selection clearing in the authenticated trip editor. |

`src/lib/data/suppliers.ts` requires no new public query: existing `getSupplierById` is sufficient, and the validator will treat a returned `deletedAt` supplier as unavailable. `src/lib/data.ts` remains a re-export-only facade.

## Interfaces / Contracts

### Compatibility module

```ts
import type { ItemType } from "@/types";
import type { SupplierType } from "@/lib/constants";

export const ITEM_SUPPLIER_TYPE = {
  hotel: "hotel",
  activity: "tour_operator",
  restaurant: "restaurant",
  transport: "transport",
} as const satisfies Partial<Record<ItemType, SupplierType>>;

export type SupplierEnabledItemType = keyof typeof ITEM_SUPPLIER_TYPE;

export function getSupplierTypeForItem(type: ItemType): SupplierType | null;
export function isSupplierTypeCompatible(type: ItemType, supplierType: string): boolean;

export class ItemSupplierCompatibilityError extends Error {
  readonly code = "ITEM_SUPPLIER_INCOMPATIBLE";
}

export function isItemSupplierCompatibilityError(
  error: unknown,
): error is ItemSupplierCompatibilityError;
```

The mapping is exhaustive for supplier-enabled item types by construction. `flight` and `note` return `null`; supplier type `other` never matches.

### Item update input

```ts
export type UpdateItemInput =
  Partial<Omit<CreateItemInput, "tripDayId" | "supplierId">> & {
    supplierId?: string | null;
  };
```

- `undefined`: caller did not change the supplier.
- `null`: caller explicitly clears the supplier.
- non-empty `string`: caller sets/replaces the supplier and the id must resolve to an active compatible supplier.

### Component contracts

```ts
type SupplierComboboxProps = {
  suppliers: Supplier[];
  name: string;
  requiredSupplierType: SupplierType;
  value: string;
  onChange: (supplier: Supplier | null) => void;
  onSupplierCreated?: (supplier: Supplier) => void;
};

type CreateSupplierDialogProps = {
  // existing props retained
  defaultType?: SupplierType;
};
```

For edit mode, `supplier.type` takes precedence over `defaultType`. The quick-create path passes `requiredSupplierType`; standalone catalog creation keeps the existing `hotel` fallback.

### Validation behavior

| Resulting item state | Outcome |
|----------------------|---------|
| No supplier | Allowed for every item type |
| Mapped item + active supplier of mapped type | Allowed |
| `flight` or `note` + supplier | Reject before mutation |
| Mapped item + supplier of another type or `other` | Reject before mutation |
| Supplier id missing or soft-deleted | Reject before mutation |

Rejected updates must leave the existing mock object/Supabase row unchanged.

## Testing Strategy

Strict TDD is enabled. Every implementation work unit follows RED → GREEN → REFACTOR with `npm run test` as the required runner.

| Layer | RED proof | GREEN / refactor proof |
|-------|-----------|------------------------|
| Pure unit | Mapping tests fail for activity, supplier-free types, and `other`; error type guard test fails. | Implement the focused compatibility module, then remove duplicated component predicates. |
| Data-layer unit/integration | Create/update tests fail for missing, deleted, mismatched, partial-result, and explicit-clear cases; rejected-update test proves no mutation. | Validate before mock/Supabase writes. Use known mock suppliers and the project's existing mocked Supabase client seam so both branches share the same pre-mutation contract. |
| Server Action | Editing with an empty supplier currently forwards `undefined`; RED expects `null`. | Parse create and edit supplier values separately and retain revalidation behavior. |
| MCP tool | Known compatibility errors currently become generic unexpected errors; nullable clear is rejected by schema. | Add nullable update schema and safe known-error mapping; retain the existing unexpected-error sanitization test. |
| E2E / interaction | Existing combobox shows nothing on empty focus, excludes activities, and can retain stale hidden values. | In the mock trip editor, assert category-only options, all empty-query matches, accent-insensitive narrowing, keyboard selection, quick-create default, and cleared hidden supplier after category change. |

After focused GREEN tests, run the complete configured checks in this order:

1. `npm run test`
2. `npm run test:e2e -- --grep "supplier"` (focused interaction proof)
3. `npx tsc --noEmit`
4. `npm run lint`
5. `npm run build`

The E2E test must assert incompatible supplier names are absent, not merely that one compatible option is present. For stale-state protection it must inspect the submitted result or hidden `supplierId`, not only the visible input label.

## Threat Matrix

N/A — this feature does not change routing, shell commands, subprocesses, VCS/PR automation, executable-file classification, or process integration.

## Migration / Rollout

No migration or feature flag is required. The change is application-level and deploys atomically with its tests.

Existing records are not rewritten. Legacy incompatible references remain readable, but opening and saving through the editor clears or rejects them according to the resulting item state. New creates and compatibility-relevant updates are protected immediately in both mock and Supabase modes. If rollback is required, revert the UI, data validation, MCP adapter, and tests together; retaining UI-only filtering is not an acceptable partial rollback.

## Open Questions

None. Product mapping, authenticated-editor scope, persistence boundary, and supplier-free behavior are defined by the proposal and delta specifications.
