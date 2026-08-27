# WhatsApp Inbound Automation Delta — issue #218

## ADDED Requirements

### Requirement: Dynamic TravelHub tools in inbound agent
The system MUST integrate controlled TravelHub data tool results into WhatsApp inbound agent decisioning without exposing Supabase credentials, raw SQL, or unrestricted table access to the LLM.

#### Scenario: Single active trip can be answered from dynamic tools
- GIVEN an inbound WhatsApp text asks about the customer's trip status
- AND the sender resolves to exactly one TravelHub client
- AND the client has exactly one active or recent trip
- AND the trip summary tool returns success
- WHEN inbound decisioning runs
- THEN the provider MUST receive only safe structured tool results
- AND the final decision MAY auto-answer when it cites the successful dynamic tool call.

#### Scenario: Multiple trips require clarification
- GIVEN an inbound WhatsApp text asks about the customer's trip status
- AND the sender resolves to a client with multiple active or recent trips
- WHEN dynamic tools run
- THEN the active trips result MUST be passed as ambiguous choices
- AND the final customer response MUST ask for clarification or escalate
- AND it MUST NOT invent which trip the customer meant.

#### Scenario: Unknown sender escalates without private data
- GIVEN an inbound WhatsApp text asks about a TravelHub trip
- AND the sender phone cannot be resolved to a TravelHub client
- WHEN dynamic tools run
- THEN the client lookup result MUST be not_found
- AND no trip-specific tool MUST run
- AND the final response MUST avoid private trip details.

#### Scenario: Tool failure escalates without technical leakage
- GIVEN a dynamic TravelHub tool returns error
- WHEN inbound decisioning runs
- THEN the final decision MUST use a safe human path
- AND the customer response MUST NOT expose SQL, Supabase, stack traces, or secrets.

#### Scenario: Payment status remains human-handled
- GIVEN an inbound WhatsApp text asks about payment status
- WHEN the payment dynamic tool runs
- THEN it MUST return needs_human under current policy
- AND the final response MUST NOT invent balances, amounts, deadlines, or payment promises.
