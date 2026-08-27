import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isServiceRoleConfigured,
  createServiceRoleClient,
} from "@/lib/supabase/server";

describe("service-role client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("reports configured when service role key and URL are present", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    expect(isServiceRoleConfigured()).toBe(true);
  });

  it("reports not configured when service role key is missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(isServiceRoleConfigured()).toBe(false);
  });

  it.skipIf(Number(process.versions.node.split(".")[0]) < 22)(
    "builds a service-role client",
    () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
      const client = createServiceRoleClient();
      expect(client).toBeDefined();
      expect((client as unknown as { supabaseUrl: string }).supabaseUrl).toBe("https://test.supabase.co");
    }
  );

  it("throws when service role key is missing", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => createServiceRoleClient()).toThrow(
      "Service role key is not configured"
    );
  });
});
