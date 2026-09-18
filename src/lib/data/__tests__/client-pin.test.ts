import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import {
  getClientPinHashByEmail,
  hasClientPin,
  rowToClient,
  setClientPin,
} from "@/lib/data/clients";
import { mockClientPinHashes } from "@/lib/mock-data";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

describe("client PIN data layer (mock mode)", () => {
  beforeEach(() => {
    mockClientPinHashes.clear();
  });

  it("stores a bcrypt hash, not plaintext, when setting a PIN", async () => {
    await setClientPin("c1", "123456");

    const hash = await getClientPinHashByEmail("ana.perez@example.com");

    expect(hash).not.toBeNull();
    expect(hash).not.toBe("123456");
    expect(await bcrypt.compare("123456", hash!)).toBe(true);
  });

  it("rotates the PIN so the old one no longer validates", async () => {
    await setClientPin("c1", "oldpin");
    const firstHash = await getClientPinHashByEmail("ana.perez@example.com");

    await setClientPin("c1", "newpin");
    const secondHash = await getClientPinHashByEmail("ana.perez@example.com");

    expect(secondHash).not.toBe(firstHash);
    expect(await bcrypt.compare("oldpin", secondHash!)).toBe(false);
    expect(await bcrypt.compare("newpin", secondHash!)).toBe(true);
  });

  it("returns null for an unknown email", async () => {
    const hash = await getClientPinHashByEmail("missing@example.com");

    expect(hash).toBeNull();
  });

  it("reports whether a client has a PIN", async () => {
    expect(await hasClientPin("c1")).toBe(false);

    await setClientPin("c1", "123456");

    expect(await hasClientPin("c1")).toBe(true);
  });

  it("never exposes pin_hash through rowToClient", () => {
    const row = {
      id: "c1",
      name: "Ana",
      email: "ana@example.com",
      phone: "",
      created_at: "2026-01-01T00:00:00Z",
      pin_hash: "$2a$10$hashedvalue",
    };

    const client = rowToClient(row);

    expect(client).not.toHaveProperty("pin_hash");
    expect(client).not.toHaveProperty("pin");
    expect((client as unknown as Record<string, unknown>).pin_hash).toBeUndefined();
  });
});
