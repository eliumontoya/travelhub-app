const AVIATIONSTACK_URL = "https://api.aviationstack.com/v1/flights";

interface AviationstackFlight {
  flight_status?: string;
}

interface AviationstackResponse {
  data?: AviationstackFlight[];
}

const FLIGHT_STATUS_LABELS: Record<string, string> = {
  scheduled: "Programado",
  active: "En vuelo",
  landed: "Aterrizó",
  cancelled: "Cancelado",
  incident: "Incidente",
  diverted: "Desviado",
};

// El modelo de datos no tiene un campo dedicado a número de vuelo: se
// extrae del título del item buscando un patrón "código de aerolínea +
// número" (ej. "AM123" en "Vuelo AM 123 a Cancún").
function extractFlightNumber(title: string): string | null {
  const tokens = title.toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/^[A-Z]{2,3}\d{1,4}$/.test(token)) return token;
    const next = tokens[i + 1];
    if (/^[A-Z]{2,3}$/.test(token) && next && /^\d{1,4}$/.test(next)) {
      return token + next;
    }
  }
  return null;
}

export async function getFlightStatus(title: string, flightNumber?: string | null): Promise<string | null> {
  const apiKey = process.env.FLIGHT_API_KEY;
  if (!apiKey) return null;

  const fn = flightNumber || extractFlightNumber(title);
  if (!fn) return null;

  try {
    const url = `${AVIATIONSTACK_URL}?access_key=${apiKey}&flight_iata=${fn}`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;

    const json: AviationstackResponse = await res.json();
    const status = json.data?.[0]?.flight_status;
    if (!status) return null;

    return FLIGHT_STATUS_LABELS[status] ?? status;
  } catch {
    return null;
  }
}
