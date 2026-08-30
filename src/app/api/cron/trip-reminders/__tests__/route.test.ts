import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const isEmailConfigured = vi.fn();
const sendTripReminder = vi.fn();
const getTripsPendingReminder = vi.fn();
const markTripReminderSent = vi.fn();

vi.mock("@/lib/email", () => ({
  isEmailConfigured,
  sendTripReminder,
}));

vi.mock("@/lib/data", () => ({
  getTripsPendingReminder,
  markTripReminderSent,
}));

function request(headers?: HeadersInit) {
  return new NextRequest("https://travelhub.test/api/cron/trip-reminders", { headers });
}

async function invoke(headers?: HeadersInit) {
  const { GET } = await import("../route");
  return GET(request(headers));
}

function useCronEnv({ nodeEnv = "test", cronSecret }: { nodeEnv?: string; cronSecret?: string } = {}) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  if (cronSecret === undefined) {
    vi.stubEnv("CRON_SECRET", undefined);
  } else {
    vi.stubEnv("CRON_SECRET", cronSecret);
  }
  vi.stubEnv("RESEND_API_KEY", "resend-key");
  vi.stubEnv("TRIP_REMINDER_DAYS_BEFORE", undefined);
}

function expectNoEmailOrReminderCalls() {
  expect(isEmailConfigured).not.toHaveBeenCalled();
  expect(getTripsPendingReminder).not.toHaveBeenCalled();
  expect(sendTripReminder).not.toHaveBeenCalled();
  expect(markTripReminderSent).not.toHaveBeenCalled();
}

const tripWithClient = {
  id: "trip-1",
  title: "Cancún familiar",
  slug: "cancun-familiar",
  status: "published",
  startDate: "2026-09-15",
  endDate: "2026-09-20",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
  reminderSentAt: null,
  client: {
    id: "client-1",
    name: "Ana Viajes",
    email: "ana@example.com",
    phone: null,
    notes: "",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  },
};

describe("GET /api/cron/trip-reminders authorization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    isEmailConfigured.mockReset();
    sendTripReminder.mockReset();
    getTripsPendingReminder.mockReset();
    markTripReminderSent.mockReset();
    isEmailConfigured.mockReturnValue(true);
    getTripsPendingReminder.mockResolvedValue([tripWithClient]);
    sendTripReminder.mockResolvedValue(true);
    markTripReminderSent.mockResolvedValue(undefined);
  });

  it("returns 503 before side effects when production CRON_SECRET is unset", async () => {
    useCronEnv({ nodeEnv: "production" });

    const response = await invoke();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Cron secret is not configured" });
    expectNoEmailOrReminderCalls();
  });

  it("returns 503 before side effects when production CRON_SECRET is blank", async () => {
    useCronEnv({ nodeEnv: "production", cronSecret: "   \t " });

    const response = await invoke();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Cron secret is not configured" });
    expectNoEmailOrReminderCalls();
  });

  it.each([
    ["missing bearer", undefined],
    ["malformed bearer", "Token cron-secret"],
    ["wrong bearer", "Bearer wrong-secret"],
  ])("returns a generic 401 before side effects for %s", async (_name, authorization) => {
    useCronEnv({ nodeEnv: "production", cronSecret: "cron-secret" });
    const headers = authorization === undefined ? undefined : { authorization };

    const response = await invoke(headers);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expectNoEmailOrReminderCalls();
  });

  it("runs the existing reminder flow for an exact bearer token", async () => {
    useCronEnv({ nodeEnv: "production", cronSecret: "cron-secret" });

    const response = await invoke({ authorization: "Bearer cron-secret" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ checked: 1, results: [{ tripId: "trip-1", sent: true }] });
    expect(isEmailConfigured).toHaveBeenCalledOnce();
    expect(getTripsPendingReminder).toHaveBeenCalledWith(3);
    expect(sendTripReminder).toHaveBeenCalledWith(tripWithClient, tripWithClient.client);
    expect(markTripReminderSent).toHaveBeenCalledWith("trip-1");
  });

  it.each([
    ["missing", undefined],
    ["blank", "   "],
  ])("allows non-production execution when CRON_SECRET is %s", async (_name, cronSecret) => {
    useCronEnv({ nodeEnv: "development", cronSecret });

    const response = await invoke();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ checked: 1, results: [{ tripId: "trip-1", sent: true }] });
    expect(isEmailConfigured).toHaveBeenCalledOnce();
    expect(getTripsPendingReminder).toHaveBeenCalledWith(3);
    expect(sendTripReminder).toHaveBeenCalledWith(tripWithClient, tripWithClient.client);
    expect(markTripReminderSent).toHaveBeenCalledWith("trip-1");
  });
});
