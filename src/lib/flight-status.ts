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

interface FlightStatusResult {
  status: string | null;
  flightNumber: string | null;
}

export async function getFlightStatus(title: string): Promise<FlightStatusResult> {
  const apiKey = process.env.FLIGHT_API_KEY;
  if (!apiKey) return { status: null, flightNumber: null };

  const flightNumber = extractFlightNumber(title);
  if (!flightNumber) return { status: null, flightNumber: null };

  try {
    const url = `${AVIATIONSTACK_URL}?access_key=${apiKey}&flight_iata=${flightNumber}`;
    const res = await fetch(url);
    if (!res.ok) return { status: null, flightNumber };

    const json: AviationstackResponse = await res.json();
    const rawStatus = json.data?.[0]?.flight_status;
    if (!rawStatus) return { status: null, flightNumber };

    return { status: FLIGHT_STATUS_LABELS[rawStatus] ?? rawStatus, flightNumber };
  } catch {
    return { status: null, flightNumber };
  }
}
