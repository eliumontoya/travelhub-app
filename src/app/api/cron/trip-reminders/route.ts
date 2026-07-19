import { NextRequest, NextResponse } from "next/server";
import { isEmailConfigured, sendTripReminder } from "@/lib/email";
import { getTripsPendingReminder, markTripReminderSent } from "@/lib/data";

const DEFAULT_DAYS_AHEAD = 3;

// Pensado para ser invocado por un cron externo (ej. Vercel Cron, ver
// vercel.json) que golpea este endpoint una vez al día. Si CRON_SECRET está
// configurado, exige el header Authorization; si no, queda abierto (misma
// degradación opcional que el resto de integraciones externas).
function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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
