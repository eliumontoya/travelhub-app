import { NextRequest, NextResponse } from "next/server";
import { isEmailConfigured, sendTripReminder } from "@/lib/email";
import { getTripsPendingReminder, markTripReminderSent } from "@/lib/data";

const DEFAULT_DAYS_AHEAD = 3;

function denyCronAccess(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Cron secret is not configured" }, { status: 503 });
    }
    return null;
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  const deniedResponse = denyCronAccess(request);
  if (deniedResponse) return deniedResponse;

  if (!isEmailConfigured()) {
    return NextResponse.json({ skipped: true, reason: "RESEND_API_KEY no configurada" });
  }

  const daysAhead = Number(process.env.TRIP_REMINDER_DAYS_BEFORE ?? DEFAULT_DAYS_AHEAD);
  const candidates = await getTripsPendingReminder(daysAhead);

  const results = await Promise.all(
    candidates.map(async (trip) => {
      try {
        const sent = await sendTripReminder(trip, trip.client);
        if (sent) await markTripReminderSent(trip.id);
        return { tripId: trip.id, sent };
      } catch (error) {
        return { tripId: trip.id, sent: false, error: (error as Error).message };
      }
    })
  );

  return NextResponse.json({ checked: candidates.length, results });
}
