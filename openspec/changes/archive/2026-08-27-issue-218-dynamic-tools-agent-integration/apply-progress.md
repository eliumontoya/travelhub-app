# Apply Progress: issue #218 — Dynamic TravelHub tools in WhatsApp inbound agent

## Code changes
- Added `WhatsAppDynamicToolResult` and `citedToolCallIds` to the inbound agent contract.
- Updated decision validation so automatic answers can cite successful dynamic tool calls, while non-success tool statuses cannot be used to auto-answer.
- Updated the LLM provider prompt/user payload so the provider receives `dynamicToolResults` and explicit safe-handling rules for `success`, `ambiguous`, `not_found`, `blocked`, `error`, and `needs_human`.
- Added inbound-service orchestration that detects dynamic TravelHub questions, resolves `event.fromPhone`, executes only `runTravelHubClientTool`, uses conversation `assignedTripId` when available, otherwise lists active trips, then runs the appropriate trip-scoped tool.
- Extended WhatsApp intent persistence to include `citedToolCallIds` and safe `dynamicToolResults` in intent entities.

## Tests added
- Inbound service dynamic success path with `getClientByWhatsappPhone`, `getClientActiveTrips`, and `getTripSummary`.
- Ambiguous active trips path.
- Client resolution `not_found`, `blocked`, and `error` paths.
- Assigned conversation trip with trip-scoped `blocked` ownership result.
- Payment `needs_human` path.
- Duplicate inbound skip still avoids tools, agent, and sends.
- Agent dynamic citation gates for successful vs non-success tool results.
