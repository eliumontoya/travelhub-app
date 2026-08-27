import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function notFound(resource: string, id: string): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: `NOT_FOUND: ${resource} ${id}`,
      },
    ],
    isError: true,
  };
}

export function mcpError(message: string): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: message,
      },
    ],
    isError: true,
  };
}

export function success(content: Record<string, unknown> | boolean): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(content),
      },
    ],
  };
}
