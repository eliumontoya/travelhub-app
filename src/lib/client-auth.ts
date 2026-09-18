import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getClientByEmail, getClientPinHashByEmail } from "@/lib/data/clients";
import { isSupabaseConfigured } from "@/lib/data/shared";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { mockClientLoginAttempts } from "@/lib/mock-data";
import type { ClientSession } from "@/types";

export type { ClientSession };

export type ClientAuthResult =
  | { ok: true; clientId: string }
  | { ok: false; reason: "invalid" | "rate_limited" };

const COOKIE_NAME = "th-client-session";
const DEV_FALLBACK_SECRET = "travelhub-dev-session-secret-do-not-use-in-production";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RATE_LIMIT_MAX_FAILURES = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type LoginAttemptRecord = {
  failures: number;
  windowStartedAt: number;
  updatedAt: number;
};

function getSessionSecret(): string {
  return process.env.CLIENT_SESSION_SECRET ?? DEV_FALLBACK_SECRET;
}

function signSession(clientId: string, expiresAt: number): string {
  const payload = `${clientId}.${expiresAt}`;
  const signature = createHmac("sha256", getSessionSecret()).update(payload, "utf8").digest("hex");
  return `${payload}.${signature}`;
}

function verifySessionCookie(value: string): ClientSession | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;

  const [clientId, expiresAtStr, signature] = parts;
  if (!clientId || !expiresAtStr || !signature) return null;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt)) return null;
  if (Date.now() >= expiresAt) return null;

  const expected = signSession(clientId, expiresAt);
  const expectedBytes = Buffer.from(expected, "utf8");
  const receivedBytes = Buffer.from(value, "utf8");
  if (receivedBytes.length !== expectedBytes.length) return null;

  return timingSafeEqual(expectedBytes, receivedBytes) ? { clientId, expiresAt } : null;
}

export async function getClientSession(): Promise<ClientSession | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return null;
  return verifySessionCookie(value);
}

export async function issueClientSession(clientId: string): Promise<void> {
  const cookieStore = await cookies();
  const expiresAt = Date.now() + SESSION_MAX_AGE_MS;
  const value = signSession(clientId, expiresAt);

  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
  });
}

export async function destroyClientSession(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    expires: new Date(0),
  });
}

// ---------- Rate-limit store (dual-mode: Supabase service-role or mock) ----------

async function getLoginAttempts(email: string): Promise<LoginAttemptRecord | null> {
  if (!isSupabaseConfigured()) {
    const raw = mockClientLoginAttempts.get(email);
    if (!raw) return null;
    return {
      failures: raw.failures,
      windowStartedAt: new Date(raw.windowStartedAt).getTime(),
      updatedAt: new Date(raw.updatedAt).getTime(),
    };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("client_login_attempts")
    .select("failures, window_started_at, updated_at")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    failures: data.failures as number,
    windowStartedAt: new Date(data.window_started_at as string).getTime(),
    updatedAt: new Date(data.updated_at as string).getTime(),
  };
}

async function setLoginAttempts(email: string, record: LoginAttemptRecord): Promise<void> {
  const nowIso = new Date(record.updatedAt).toISOString();
  const windowStartedAtIso = new Date(record.windowStartedAt).toISOString();

  if (!isSupabaseConfigured()) {
    mockClientLoginAttempts.set(email, {
      failures: record.failures,
      windowStartedAt: windowStartedAtIso,
      updatedAt: nowIso,
    });
    return;
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("client_login_attempts").upsert(
    {
      email,
      failures: record.failures,
      window_started_at: windowStartedAtIso,
      updated_at: nowIso,
    },
    { onConflict: "email" }
  );
  if (error) throw error;
}

async function deleteLoginAttempts(email: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    mockClientLoginAttempts.delete(email);
    return;
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("client_login_attempts").delete().eq("email", email);
  if (error) throw error;
}

async function isRateLimited(email: string): Promise<boolean> {
  const record = await getLoginAttempts(email);
  if (!record) return false;
  if (Date.now() - record.windowStartedAt > RATE_LIMIT_WINDOW_MS) return false;
  return record.failures >= RATE_LIMIT_MAX_FAILURES;
}

async function recordFailedAttempt(email: string): Promise<void> {
  const now = Date.now();
  const record = await getLoginAttempts(email);

  if (!record || now - record.windowStartedAt > RATE_LIMIT_WINDOW_MS) {
    await setLoginAttempts(email, { failures: 1, windowStartedAt: now, updatedAt: now });
  } else {
    await setLoginAttempts(email, {
      failures: record.failures + 1,
      windowStartedAt: record.windowStartedAt,
      updatedAt: now,
    });
  }
}

async function resetLoginAttempts(email: string): Promise<void> {
  await deleteLoginAttempts(email);
}

export async function verifyClientCredentials(email: string, pin: string): Promise<ClientAuthResult> {
  const normalizedEmail = email.trim().toLowerCase();

  if (await isRateLimited(normalizedEmail)) {
    return { ok: false, reason: "rate_limited" };
  }

  const hash = await getClientPinHashByEmail(normalizedEmail);
  if (!hash) {
    await recordFailedAttempt(normalizedEmail);
    return { ok: false, reason: "invalid" };
  }

  const valid = await bcrypt.compare(pin, hash);
  if (!valid) {
    await recordFailedAttempt(normalizedEmail);
    return { ok: false, reason: "invalid" };
  }

  await resetLoginAttempts(normalizedEmail);

  const client = await getClientByEmail(normalizedEmail);
  if (!client) {
    // Defensive: a hash exists only when a client row exists.
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, clientId: client.id };
}
