import { Client, Trip } from "@/types";

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

function tripPublicUrl(trip: Trip) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}/t/${trip.slug}`;
}

// Envía el recordatorio vía la API HTTP de Resend con fetch plano (sin SDK,
// ver convenciones del repo). No-op silencioso si RESEND_API_KEY no está
// configurada, mismo patrón de degradación que Google Maps/Places.
export async function sendTripReminder(trip: Trip, client: Client): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  if (!client.email) return false;

  const from = process.env.EMAIL_FROM ?? "TravelHub <onboarding@resend.dev>";
  const url = tripPublicUrl(trip);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: client.email,
      subject: `Tu viaje "${trip.title}" está por comenzar`,
      html: `<p>Hola ${client.name},</p><p>Tu viaje <strong>${trip.title}</strong> comienza el ${trip.startDate}. Puedes ver todos los detalles aquí:</p><p><a href="${url}">${url}</a></p>`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend respondió ${response.status}: ${await response.text()}`);
  }
  return true;
}
