import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isMcpApiKeyConfigured,
  validateMcpApiKey,
} from "@/lib/mcp/auth";

function resetEnv() {
  vi.unstubAllEnvs();
}

beforeEach(() => {
  resetEnv();
});

afterEach(() => {
  resetEnv();
});

describe("isMcpApiKeyConfigured", () => {
  it("returns false when MCP_API_KEY env is unset", () => {
    expect(isMcpApiKeyConfigured()).toBe(false);
  });

  it("returns false when MCP_API_KEY env is only whitespace", () => {
    vi.stubEnv("MCP_API_KEY", "   \t  ");
    expect(isMcpApiKeyConfigured()).toBe(false);
  });

  it("returns true when MCP_API_KEY env has a non-empty value", () => {
    vi.stubEnv("MCP_API_KEY", "secret-key");
    expect(isMcpApiKeyConfigured()).toBe(true);
  });
});

describe("validateMcpApiKey", () => {
  it("returns false when no Authorization header is provided", () => {
    vi.stubEnv("MCP_API_KEY", "secret-key");
    expect(validateMcpApiKey(undefined)).toBe(false);
    expect(validateMcpApiKey(null)).toBe(false);
  });

  it("returns false when MCP_API_KEY env is unset", () => {
    expect(validateMcpApiKey("Bearer secret-key")).toBe(false);
  });

  it("returns false when scheme is not Bearer", () => {
    vi.stubEnv("MCP_API_KEY", "secret-key");
    expect(validateMcpApiKey("Basic secret-key")).toBe(false);
    expect(validateMcpApiKey("Token secret-key")).toBe(false);
  });

  it("returns false when token does not match the configured key", () => {
    vi.stubEnv("MCP_API_KEY", "secret-key");
    expect(validateMcpApiKey("Bearer wrong-key")).toBe(false);
  });

  it("returns true for an exact single-key match", () => {
    vi.stubEnv("MCP_API_KEY", "secret-key");
    expect(validateMcpApiKey("Bearer secret-key")).toBe(true);
  });

  it("accepts any key in a comma-separated allow-list", () => {
    vi.stubEnv("MCP_API_KEY", "key-a, key-b ,key-c");
    expect(validateMcpApiKey("Bearer key-a")).toBe(true);
    expect(validateMcpApiKey("Bearer key-b")).toBe(true);
    expect(validateMcpApiKey("Bearer key-c")).toBe(true);
  });

  it("returns false when no key in the allow-list matches", () => {
    vi.stubEnv("MCP_API_KEY", "key-a, key-b");
    expect(validateMcpApiKey("Bearer key-c")).toBe(false);
  });

  it("returns false for a malformed Authorization header", () => {
    vi.stubEnv("MCP_API_KEY", "secret-key");
    expect(validateMcpApiKey("Bearer")).toBe(false);
    expect(validateMcpApiKey("secret-key")).toBe(false);
    expect(validateMcpApiKey("Bearer ")).toBe(false);
  });

  it("rejects when the configured allow-list trims down to empty", () => {
    vi.stubEnv("MCP_API_KEY", "  , , ,");
    expect(validateMcpApiKey("Bearer anything")).toBe(false);
  });
});