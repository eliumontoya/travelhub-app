import { beforeEach, describe, expect, it, vi } from "vitest";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import {
  destroyClientSession,
  getClientSession,
  issueClientSession,
  verifyClientCredentials,
} from "@/lib/client-auth";
import { setClientPin } from "@/lib/data/clients";
import { mockClientLoginAttempts, mockClientPinHashes } from "@/lib/mock-data";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

function createMockCookieStore() {
  const store = new Map<string, string>();
  return {
    get: (name: string) => (store.has(name) ? { name, value: store.get(name)! } : undefined),
    getAll: () => [...store.entries()].map(([name, value]) => ({ name, value })),
    set: vi.fn((name: string, value: string, _options?: unknown) => {
      store.set(name, value);
    }),
    delete: vi.fn((name: string) => {
      store.delete(name);
    }),
  } as unknown as Awaited<ReturnType<typeof cookies>>;
}

describe("client-auth", () => {
  let mockStore: ReturnType<typeof createMockCookieStore>;

  beforeEach(() => {
    mockClientPinHashes.clear();
    mockClientLoginAttempts.clear();
    vi.clearAllMocks();
    mockStore = createMockCookieStore();
    vi.mocked(cookies).mockResolvedValue(mockStore);
  });

  describe("cookie session", () => {
    it("issues a signed HttpOnly session cookie", async () => {
      await issueClientSession("c1");

      expect(mockStore.set).toHaveBeenCalledTimes(1);
      expect(mockStore.set).toHaveBeenCalledWith(
        "th-client-session",
        expect.stringMatching(/^c1\.\d+\.[a-f0-9]{64}$/),
        expect.objectContaining({
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          secure: false,
        })
      );
    });

    it("returns the client session from a valid cookie", async () => {
      await issueClientSession("c1");

      const session = await getClientSession();

      expect(session).toEqual({ clientId: "c1", expiresAt: expect.any(Number) });
      expect(session?.expiresAt).toBeGreaterThan(Date.now());
      expect(session?.expiresAt).toBeLessThanOrEqual(Date.now() + THIRTY_DAYS_MS + 1000);
    });

    it("returns null when the session cookie is missing", async () => {
      const session = await getClientSession();

      expect(session).toBeNull();
    });

    it("returns null when the cookie value has been tampered with", async () => {
      await issueClientSession("c1");
      const originalValue = mockStore.get("th-client-session")?.value ?? "";
      mockStore.set("th-client-session", originalValue.replace(/.$/, "x"), {});

      const session = await getClientSession();

      expect(session).toBeNull();
    });

    it("returns null when the session cookie has expired", async () => {
      vi.useFakeTimers();
      await issueClientSession("c1");
      vi.advanceTimersByTime(THIRTY_DAYS_MS + 1000);

      const session = await getClientSession();

      expect(session).toBeNull();
      vi.useRealTimers();
    });

    it("destroys the session cookie so subsequent verify returns null", async () => {
      await issueClientSession("c1");
      expect(await getClientSession()).not.toBeNull();

      await destroyClientSession();

      expect(mockStore.set).toHaveBeenLastCalledWith(
        "th-client-session",
        "",
        expect.objectContaining({
          httpOnly: true,
          path: "/",
          maxAge: 0,
          expires: expect.any(Date),
        })
      );
      expect(await getClientSession()).toBeNull();
    });
  });

  describe("verifyClientCredentials", () => {
    it("returns ok:false invalid for unknown email", async () => {
      const result = await verifyClientCredentials("unknown@example.com", "123456");

      expect(result).toEqual({ ok: false, reason: "invalid" });
    });

    it("returns ok:false invalid when the PIN does not match", async () => {
      await setClientPin("c1", "123456");

      const result = await verifyClientCredentials("ana.perez@example.com", "wrongpin");

      expect(result).toEqual({ ok: false, reason: "invalid" });
    });

    it("returns ok:true with clientId when email and PIN are valid", async () => {
      await setClientPin("c1", "123456");

      const result = await verifyClientCredentials("ana.perez@example.com", "123456");

      expect(result).toEqual({ ok: true, clientId: "c1" });
    });

    it("rate-limits after the threshold of failed attempts", async () => {
      await setClientPin("c1", "123456");

      for (let i = 0; i < 5; i++) {
        const result = await verifyClientCredentials("ana.perez@example.com", "wrongpin");
        expect(result).toEqual({ ok: false, reason: "invalid" });
      }

      const limited = await verifyClientCredentials("ana.perez@example.com", "wrongpin");
      expect(limited).toEqual({ ok: false, reason: "rate_limited" });
    });

    it("resets the failure counter after a successful login", async () => {
      await setClientPin("c1", "123456");

      await verifyClientCredentials("ana.perez@example.com", "wrongpin");
      await verifyClientCredentials("ana.perez@example.com", "wrongpin");

      const success = await verifyClientCredentials("ana.perez@example.com", "123456");
      expect(success).toEqual({ ok: true, clientId: "c1" });

      // After success the counter is reset, so a fresh failure does not lock out immediately.
      const afterSuccess = await verifyClientCredentials("ana.perez@example.com", "wrongpin");
      expect(afterSuccess).toEqual({ ok: false, reason: "invalid" });
    });

    it("isolates rate-limit counters per email", async () => {
      await setClientPin("c1", "123456");
      await setClientPin("c2", "654321");

      for (let i = 0; i < 6; i++) {
        await verifyClientCredentials("ana.perez@example.com", "wrongpin");
      }

      const other = await verifyClientCredentials("gomez.family@example.com", "654321");
      expect(other).toEqual({ ok: true, clientId: "c2" });
    });

    it("rejects attempts while the rate-limit window is active", async () => {
      await setClientPin("c1", "123456");

      for (let i = 0; i < 6; i++) {
        await verifyClientCredentials("ana.perez@example.com", "wrongpin");
      }

      // Correct PIN should still be rejected because the email is rate-limited.
      const correctPinWhileLimited = await verifyClientCredentials("ana.perez@example.com", "123456");
      expect(correctPinWhileLimited).toEqual({ ok: false, reason: "rate_limited" });
    });

    it("allows a new attempt after the rate-limit window expires", async () => {
      vi.useFakeTimers();
      await setClientPin("c1", "123456");

      for (let i = 0; i < 6; i++) {
        await verifyClientCredentials("ana.perez@example.com", "wrongpin");
      }

      vi.advanceTimersByTime(FIFTEEN_MINUTES_MS + 1000);

      const result = await verifyClientCredentials("ana.perez@example.com", "123456");
      expect(result).toEqual({ ok: true, clientId: "c1" });
      vi.useRealTimers();
    });
  });

  describe("rate-limit sliding window", () => {
    it("starts a new window when the previous one has expired", async () => {
      vi.useFakeTimers();
      await setClientPin("c1", "123456");

      // First burst: 3 failures inside the first window.
      await verifyClientCredentials("ana.perez@example.com", "wrongpin");
      await verifyClientCredentials("ana.perez@example.com", "wrongpin");
      await verifyClientCredentials("ana.perez@example.com", "wrongpin");

      // Move past the original window.
      vi.advanceTimersByTime(FIFTEEN_MINUTES_MS + 1000);

      // The next failure starts a fresh window, so it does not lock out.
      const result = await verifyClientCredentials("ana.perez@example.com", "wrongpin");
      expect(result).toEqual({ ok: false, reason: "invalid" });

      // We can accumulate up to 4 more failures in the new window before locking out.
      for (let i = 0; i < 4; i++) {
        const r = await verifyClientCredentials("ana.perez@example.com", "wrongpin");
        expect(r).toEqual({ ok: false, reason: "invalid" });
      }

      const locked = await verifyClientCredentials("ana.perez@example.com", "wrongpin");
      expect(locked).toEqual({ ok: false, reason: "rate_limited" });
      vi.useRealTimers();
    });
  });
});
