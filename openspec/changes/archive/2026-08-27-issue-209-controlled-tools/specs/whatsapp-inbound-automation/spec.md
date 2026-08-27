## ADDED Requirements

### Requirement: Controlled TravelHub data tools
The system MUST expose server-side, allowlisted TravelHub data tools for WhatsApp agent use without giving the LLM Supabase credentials, raw SQL access, or direct table access.

#### Scenario: Allowed tool executes with typed input
- GIVEN the WhatsApp agent requests a supported TravelHub data tool with valid typed arguments
- WHEN the tool router executes the request server-side
- THEN it MUST execute only code-authored table-specific queries
- AND it MUST return a structured tool result with a status and safe data payload.

#### Scenario: Unsupported tool is rejected
- GIVEN the WhatsApp agent requests a tool name outside the allowlist
- WHEN the tool router validates the request
- THEN it MUST reject the request with a structured blocked result
- AND it MUST NOT query TravelHub domain tables for that request.

### Requirement: WhatsApp phone client resolution
The system MUST resolve dynamic TravelHub lookups from the inbound WhatsApp phone to a TravelHub client before returning client- or trip-specific data.

#### Scenario: Linked WhatsApp contact resolves client
- GIVEN a WhatsApp contact row exists for the inbound phone and has a linked TravelHub client
- WHEN client resolution runs
- THEN the result MUST identify the client with exact confidence.

#### Scenario: No client match escalates safely
- GIVEN no linked WhatsApp contact or exact client-phone match exists for the inbound phone
- WHEN client resolution runs
- THEN the result MUST indicate no match
- AND the caller MUST be able to escalate without exposing private TravelHub data.

### Requirement: Trip-scoped tool ownership guard
Every trip-scoped TravelHub data tool MUST verify that the requested trip belongs to the client resolved from the inbound WhatsApp phone before returning trip details.

#### Scenario: Owned trip summary is returned
- GIVEN a resolved client asks about a trip assigned to that client
- WHEN the trip summary tool runs
- THEN it MUST return only safe trip summary fields.

#### Scenario: Non-owned trip is blocked
- GIVEN a resolved client attempts to query a trip id not assigned to that client
- WHEN any trip-scoped tool runs
- THEN the tool MUST return a blocked ownership result
- AND it MUST NOT return trip details.

### Requirement: Dynamic trip ambiguity handling
The system MUST detect when a client has zero, one, or multiple active/recent trips so the agent can answer, ask for clarification, or escalate safely.

#### Scenario: Multiple active trips require clarification
- GIVEN a resolved client has multiple active or recent trips
- WHEN active trip lookup runs
- THEN the result MUST mark the lookup as ambiguous
- AND include only concise trip choices suitable for asking the customer to clarify.

### Requirement: Sensitive dynamic data minimization
Dynamic tools MUST minimize sensitive data returned to the agent, and payment status MUST not be auto-answerable until TravelHub has an explicit payment data model and policy.

#### Scenario: Payment status requires human policy
- GIVEN a resolved client asks about payments
- WHEN the payment status tool runs before a payment system-of-record exists
- THEN it MUST return a needs-human result
- AND it MUST NOT invent balances, amounts, or payment promises.

#### Scenario: Document status summarizes without links
- GIVEN a resolved client asks whether documents are available or missing
- WHEN document status lookup runs for an owned trip
- THEN it MUST return counts and general availability state
- AND it MUST NOT return signed URLs, storage paths, or private client document contents.

### Requirement: Dynamic tool audit trail
The system SHOULD record sanitized evidence of TravelHub data tool calls for debugging and downstream CRM processing without making audit availability a prerequisite for customer-safe responses.

#### Scenario: Tool call audit succeeds
- GIVEN `crm_sync_events` is available
- WHEN a controlled data tool completes
- THEN a pending audit event SHOULD be staged with tool name, result status, and non-secret identifiers.

#### Scenario: Tool call audit fails non-fatally
- GIVEN the tool data lookup succeeds but audit insertion fails
- WHEN the tool returns its result
- THEN the result SHOULD remain available
- AND include audit failure diagnostics that do not expose secrets.
