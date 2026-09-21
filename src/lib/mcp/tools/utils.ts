import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { mcpError } from "@/lib/mcp/errors";

/**
 * Serializes a value into a single text content block, mirroring the
 * `success()` envelope but with raw string body (used when the value is
 * already a string, e.g. a pre-built message).
 */
export function textResult(text: string): CallToolResult {
  return {
    content: [{ type: "text", text }],
  };
}

/**
 * Extracts a safe, plain message string from an unknown error value.
 * Never returns a stack trace or arbitrary nested fields — only `Error.message`
 * or a stringified fallback so that the secret-safe envelope can be built.
 */
export function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

/**
 * Heuristic that flags an error message as a not-found-style failure based on
 * the English/Spanish wording used by the data layer. Centralized here so the
 * tool layer can route to the `notFound()` envelope consistently.
 */
export function isNotFoundMessage(msg: string): boolean {
  const lowered = msg.toLowerCase();
  return (
    lowered.includes("no encontrado") ||
    lowered.includes("no pertenece") ||
    lowered.includes("not found")
  );
}

/**
 * Builds a sanitized error envelope for unexpected failures. Never echoes the
 * raw error message (which may contain internal identifiers, RLS hints, or
 * SQL fragments); the agent gets a stable, actionable signal and nothing else.
 */
export function unexpectedError(_err: unknown): CallToolResult {
  return mcpError("An unexpected error occurred");
}