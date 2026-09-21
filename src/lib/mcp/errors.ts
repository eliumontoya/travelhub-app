import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Builds a successful tool result. The MCP protocol expects content as an
 * array of typed blocks; we use a single `text` block carrying JSON-encoded
 * data so the same envelope works for objects, arrays, and scalars.
 */
export function success(content: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(content) }],
  };
}

/**
 * Builds a not-found error result. The resource label is user-readable (e.g.
 * `upload`, `service`) and the id is the caller-supplied identifier so the
 * agent can correlate the failure with its prior call.
 */
export function notFound(resource: string, id: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: `NOT_FOUND: ${resource} ${id}` }],
  };
}

/**
 * Builds a generic error result for an actionable, non-stack-trace error
 * condition (e.g. archived trip, business rule violation).
 */
export function mcpError(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}