import { Client, Trip, TripWithDetails } from "@/types";
import { formatCost, formatDateLong, itemTypeMeta } from "@/lib/item-meta";
import { formatItemMetadataSummary } from "@/lib/item-display";

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function buildItineraryHtml(trip: TripWithDetails, message?: string): string {
  const url = tripPublicUrl(trip);
  const dateRange = `${formatDateLong(trip.startDate)} – ${formatDateLong(trip.endDate)}`;

  const daysHtml = trip.days
    .map((day) => {
      const itemsHtml = day.items
        .map((item) => {
          const meta = itemTypeMeta[item.type];
          const metaSummary = formatItemMetadataSummary(item);
          const lines: string[] = [];
          lines.push(
            `<div style="display:flex;gap:8px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #eee;">`
          );
          lines.push(
            `<span style="font-size:20px;line-height:1;">${meta.icon}</span>`
          );
          lines.push(`<div style="flex:1;">`);
          lines.push(
            `<div style="font-weight:600;color:#111;">${escapeHtml(item.title)}${
              item.startTime ? ` <span style="font-weight:400;color:#888;font-size:12px;">· ${escapeHtml(item.startTime)}</span>` : ""
            }</div>`
          );
          if (item.location)
            lines.push(`<div style="color:#666;font-size:13px;">${escapeHtml(item.location)}</div>`);
          if (item.notes)
            lines.push(`<div style="color:#999;font-size:13px;">${escapeHtml(item.notes)}</div>`);
          if (item.confirmationCode)
            lines.push(
              `<div style="color:#999;font-size:12px;">Confirmación: ${escapeHtml(item.confirmationCode)}</div>`
            );
          if (metaSummary)
            lines.push(
              `<div style="color:${item.type === "flight" ? "#0284c7" : "#999"};font-size:12px;">${escapeHtml(metaSummary)}</div>`
            );
          if (trip.showCostsToClient && item.cost !== undefined)
            lines.push(
              `<div style="color:#666;font-size:12px;">Costo: ${escapeHtml(formatCost(item.cost, trip.currency))}</div>`
            );
          lines.push(`</div></div>`);
          return lines.join("");
        })
        .join("");

      return `
        <div style="margin-bottom:20px;">
          <h2 style="font-size:16px;color:#111;margin:0 0 4px;">${escapeHtml(formatDateLong(day.date))}</h2>
          ${itemsHtml || `<div style="color:#999;font-size:13px;padding:6px 0;">Sin actividades</div>`}
        </div>`;
    })
    .join("");

  const messageHtml = message
    ? `<div style="background:#f1f5f9;border-left:4px solid #3b82f6;padding:12px 16px;margin-bottom:20px;border-radius:6px;color:#334155;font-size:14px;">${escapeHtml(message)}</div>`
    : "";

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">
    <h1 style="font-size:22px;margin:0 0 4px;">${escapeHtml(trip.title)}</h1>
    <p style="color:#666;margin:0 0 16px;">${escapeHtml(dateRange)} · ${trip.travelerCount} ${
      trip.travelerCount === 1 ? "viajero" : "viajeros"
    }</p>
    ${messageHtml}
    ${daysHtml}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
    <p style="color:#666;font-size:14px;">
      Ver itinerario completo y agregarlo al calendario:
      <a href="${url}" style="color:#2563eb;">${url}</a>
    </p>
  </div>`;
}

export interface SendItineraryResult {
  ok: boolean;
  reason?: string;
}

// Envía el itinerario completo por correo vía Resend (mismo transporte que
// sendTripReminder). Degrada con gracia si RESEND_API_KEY no está configurada.
export async function sendItineraryEmail(
  trip: TripWithDetails,
  recipients: string[],
  message?: string
): Promise<SendItineraryResult> {
  if (!isEmailConfigured()) {
    return { ok: false, reason: "RESEND_API_KEY no configurada: el envío por correo está desactivado." };
  }
  if (recipients.length === 0) {
    return { ok: false, reason: "No hay destinatarios para enviar el itinerario." };
  }

  const from = process.env.EMAIL_FROM ?? "TravelHub <onboarding@resend.dev>";
  const html = buildItineraryHtml(trip, message);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `Tu itinerario: ${trip.title}`,
      html,
    }),
  });

  if (!response.ok) {
    return { ok: false, reason: `Resend respondió ${response.status}: ${await response.text()}` };
  }
  return { ok: true };
}
