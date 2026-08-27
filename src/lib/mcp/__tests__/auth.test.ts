import { describe, it, expect } from "vitest";
import { validateMcpApiKey } from "@/lib/mcp/auth";

describe("MCP auth gate", () => {
  it("accepts a matching Bearer key", () => {
    process.env.MCP_API_KEY = "valid-key";
    expect(validateMcpApiKey("Bearer valid-key")).toBe(true);
  });

  it("rejects a mismatched key", () => {
    process.env.MCP_API_KEY = "valid-key";
    expect(validateMcpApiKey("Bearer wrong-key")).toBe(false);
  });

  it("rejects missing header", () => {
    process.env.MCP_API_KEY = "valid-key";
    expect(validateMcpApiKey(undefined)).toBe(false);
  });

  it("rejects malformed header", () => {
    process.env.MCP_API_KEY = "valid-key";
    expect(validateMcpApiKey("valid-key")).toBe(false);
  });

  it("supports comma-separated allow-list for rotation", () => {
    process.env.MCP_API_KEY = "old-key, new-key";
    expect(validateMcpApiKey("Bearer old-key")).toBe(true);
    expect(validateMcpApiKey("Bearer new-key")).toBe(true);
    expect(validateMcpApiKey("Bearer other-key")).toBe(false);
  });

  it("rejects everything when MCP_API_KEY is empty", () => {
    process.env.MCP_API_KEY = "";
    expect(validateMcpApiKey("Bearer anything")).toBe(false);
  });
});
