import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { mcpError } from "@/lib/mcp/errors";

export function textResult(value: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: typeof value === "string" ? value : JSON.stringify(value),
      },
    ],
  };
}

export function safeMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function isNotFoundMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("no encontrado") || lower.includes("not found");
}

export function unexpectedError(err: unknown): CallToolResult {
  const message = safeMessage(err);
  // Never leak stack traces or secrets.
  return mcpError(isNotFoundMessage(message) ? "NOT_FOUND" : "An unexpected error occurred");
}
